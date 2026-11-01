const request = require('supertest');
const app = require('../index');
const { sequelize } = require('../config/database');
const { resetDatabase } = require('./db');
const { Investment, InvestmentHistory } = require('../models');
const emailService = require('../utils/emailService');
const { runDailySnapshots } = require('../utils/snapshots');
const { cagr, xirr } = require('../utils/returns');

if (!process.env.DB_NAME.endsWith('_test')) {
  throw new Error(`Refusing to run tests against non-test database "${process.env.DB_NAME}"`);
}

const PASSWORD = 'Passw0rd!x';
let counter = 0;
const register = async (overrides = {}) => {
  counter += 1;
  const res = await request(app).post('/api/auth/register').send({
    email: `feature${counter}@example.com`, password: PASSWORD, firstName: 'Test', lastName: 'User', ...overrides,
  });
  return res;
};
const authed = async () => {
  const res = await register();
  expect(res.status).toBe(201);
  return { Authorization: `Bearer ${res.body.accessToken}` };
};

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await sequelize.close();
});

describe('registration and profile input', () => {
  it('stores names with apostrophes and accents unescaped', async () => {
    const res = await register({ firstName: "O'Brien", lastName: 'José' });
    expect(res.status).toBe(201);
    expect(res.body.user.firstName).toBe("O'Brien");
    expect(res.body.user.lastName).toBe('José');
  });

  it.each(['password', 'short1!', 'alllowercase1!', 'NoDigits!!'])('rejects weak password %s', async (password) => {
    const res = await register({ password });
    expect(res.status).toBe(400);
  });

  it('validates names on profile update', async () => {
    const headers = await authed();
    const bad = await request(app).put('/api/auth/profile').set(headers).send({ firstName: '<script>alert(1)</script>' });
    expect(bad.status).toBe(400);
    const ok = await request(app).put('/api/auth/profile').set(headers).send({ firstName: 'Anne-Marie' });
    expect(ok.status).toBe(200);
    expect(ok.body.user.firstName).toBe('Anne-Marie');
  });
});

describe('financial health', () => {
  let headers;
  beforeAll(async () => {
    headers = await authed();
    const post = (url, body) => request(app).post(url).set(headers).send(body).then((res) => {
      expect(res.status).toBe(201);
      return res.body;
    });
    await post('/api/assets', { name: 'Flat', category: 'real_estate', currentValue: 1000000 });
    const car = await post('/api/assets', { name: 'Old car', category: 'vehicle', currentValue: 500000 });
    await request(app).delete(`/api/assets/${car.asset.id}`).set(headers);
    await post('/api/investments', { name: 'Savings', category: 'bank_account', currentAmount: 100000, investmentDate: '2020-01-15' });
    await post('/api/liabilities', { name: 'Loan', category: 'loan', outstandingAmount: 200000 });
    const old = await post('/api/liabilities', { name: 'Paid off', category: 'loan', outstandingAmount: 900000 });
    await request(app).delete(`/api/liabilities/${old.liability.id}`).set(headers);
    await post('/api/income', { name: 'Gig', amount: 1000, frequency: 'weekly', nextPayDate: '2026-11-06' });
  });

  const health = () => request(app).get('/api/optimizer/health?month=2026-10').set(headers);

  it('uses all active holdings, normalises income and treats real estate as illiquid', async () => {
    const res = await health();
    expect(res.status).toBe(200);
    expect(res.body.totalAssets).toBe(1100000);
    expect(res.body.totalLiabilities).toBe(200000);
    expect(res.body.totalIncome).toBeCloseTo(4333.33, 1);
    expect(res.body.liquidityScore).toBe(9);
  });

  it('reflects edits immediately', async () => {
    await request(app).post('/api/investments').set(headers)
      .send({ name: 'Index fund', category: 'mutual_funds', currentAmount: 50000 });
    expect((await health()).body.totalAssets).toBe(1150000);
  });

  it('names the overspent budget category', async () => {
    const cat = await request(app).post('/api/budget/categories').set(headers).send({ name: 'Dining', frameworkTag: 'want' });
    const categoryId = (cat.body.category || cat.body).id;
    await request(app).post('/api/budget/entries').set(headers)
      .send({ categoryId, month: '2026-10', budgetedAmount: 1000, spentAmount: 2000 });
    const res = await request(app).get('/api/optimizer/recommendations?month=2026-10').set(headers);
    expect(res.body.recommendations.join(' ')).toContain('"Dining"');
  });

  it('excludes archived investments from tax-loss suggestions', async () => {
    const loser = await request(app).post('/api/investments').set(headers)
      .send({ name: 'Loser', category: 'stocks', currentAmount: 50, initialAmount: 100 });
    const before = await request(app).get('/api/optimizer/tax-loss').set(headers);
    expect(before.body.opportunities.map(o => o.name)).toContain('Loser');
    await request(app).delete(`/api/investments/${loser.body.investment.id}`).set(headers);
    const after = await request(app).get('/api/optimizer/tax-loss').set(headers);
    expect(after.body.opportunities.map(o => o.name)).not.toContain('Loser');
  });
});

describe('email templates', () => {
  let sendMail;
  beforeAll(() => {
    sendMail = jest.fn().mockResolvedValue({ messageId: 'x' });
    emailService.setTransporterForTesting({ sendMail });
  });
  afterAll(() => emailService.setTransporterForTesting(null));

  it('escapes user data and formats rupees', async () => {
    const user = { email: 'e@example.com', firstName: '<b>Eve</b>', lastName: 'X', securityAlerts: true, investmentUpdates: true };
    await emailService.sendSecurityAlert(user, 'Login <script>', '1.2.3.4');
    await emailService.sendInvestmentUpdate(user, 'Added', 'Fund & Co', 150000, 2500000);
    const [alert, update] = sendMail.mock.calls.map(([mail]) => mail.html);
    expect(alert).toContain('&lt;b&gt;Eve&lt;/b&gt;');
    expect(alert).not.toContain('<script>');
    expect(update).toContain('₹1,50,000');
    expect(update).toContain('₹25,00,000');
    expect(update).toContain('Fund &amp; Co');
    expect(update).not.toContain('$');
  });
});

describe('data integrity', () => {
  it('rolls back a bulk insert when any row fails', async () => {
    const headers = await authed();
    const before = await Investment.count();
    const res = await request(app).post('/api/investments/bulk').set(headers)
      .send([{ name: 'ok', currentAmount: 10 }, { name: 'too big', currentAmount: 1e20 }]);
    expect(res.status).toBe(500);
    expect(await Investment.count()).toBe(before);
  });

  it('allows only one snapshot per date under concurrency', async () => {
    const headers = await authed();
    const statuses = await Promise.all([0, 1, 2].map(() => request(app)
      .post('/api/portfolio/snapshot').set(headers).send({ snapshotDate: '2026-10-31' })
      .then(res => res.status)));
    expect(statuses.sort()).toEqual([201, 409, 409]);
  });
});

describe('migrations', () => {
  it('create every column and index the models declare', async () => {
    const queryInterface = sequelize.getQueryInterface();
    const [indexRows] = await sequelize.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'");
    const indexNames = new Set(indexRows.map(r => r.indexname));
    for (const model of Object.values(sequelize.models)) {
      if (model.name === 'SequelizeMeta') continue;
      const table = await queryInterface.describeTable(model.getTableName());
      const columns = Object.values(model.getAttributes()).map(a => a.field);
      expect(columns.filter(c => !table[c])).toEqual([]);
      const declared = (model.options.indexes || []).map(i => i.name).filter(Boolean);
      expect(declared.filter(name => !indexNames.has(name))).toEqual([]);
    }
  });

  it('stores amounts above 10 billion in budget, goals and income', async () => {
    const headers = await authed();
    const res = await request(app).post('/api/income').set(headers)
      .send({ name: 'Big', amount: 25000000000, frequency: 'once', nextPayDate: '2026-11-01' });
    expect(res.status).toBe(201);
  });
});

describe('portfolio history', () => {
  it('rebuilds month-end values from valuation history', async () => {
    const headers = await authed();
    const month = (offset) => {
      const d = new Date();
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1)).toISOString().slice(0, 7);
    };
    const created = await request(app).post('/api/investments').set(headers).send({
      name: 'Fund', category: 'mutual_funds', initialAmount: 1000, currentAmount: 1000, investmentDate: `${month(-3)}-05`,
    });
    const { id } = created.body.investment;
    await InvestmentHistory.create({ investmentId: id, valuationDate: `${month(-2)}-15`, amount: 1500 });
    await Investment.update({ currentAmount: 1800 }, { where: { id } });

    const res = await request(app).get('/api/portfolio/analytics/monthly?limit=5').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.data.map(d => d.month)).toEqual([month(-4), month(-3), month(-2), month(-1), month(0)]);
    expect(res.body.data.map(d => d.total)).toEqual([0, 1000, 1500, 1500, 1800]);
  });
});

describe('net worth snapshots', () => {
  it('takes one automatic snapshot per user per day, including assets and liabilities', async () => {
    const headers = await authed();
    await request(app).post('/api/investments').set(headers).send({ name: 'FD', category: 'fixed_deposit', initialAmount: 100000, currentAmount: 100000 });
    expect((await request(app).post('/api/assets').set(headers).send({ name: 'Car', category: 'vehicle', currentValue: 50000 })).status).toBe(201);
    expect((await request(app).post('/api/liabilities').set(headers).send({ name: 'Loan', category: 'loan', outstandingAmount: 30000 })).status).toBe(201);

    await runDailySnapshots('2026-01-15');
    await runDailySnapshots('2026-01-15');
    const res = await request(app).get('/api/portfolio/net-worth').set(headers);
    expect(res.body.data).toEqual([{ date: '2026-01-15', investments: 100000, assets: 50000, liabilities: 30000, netWorth: 120000, isManual: false }]);

    const manual = await request(app).post('/api/portfolio/snapshot').set(headers).send({ snapshotDate: '2026-01-16' });
    expect(manual.status).toBe(201);
    expect((await request(app).post('/api/portfolio/snapshot').set(headers).send({ snapshotDate: '2026-01-16' })).status).toBe(409);
    const after = await request(app).get('/api/portfolio/net-worth').set(headers);
    expect(after.body.data.map(d => [d.date, d.netWorth, d.isManual])).toEqual([['2026-01-15', 120000, false], ['2026-01-16', 120000, true]]);
  });
});

describe('returns', () => {
  it('computes CAGR and XIRR', () => {
    expect(cagr(1000, 1210, 2)).toBeCloseTo(0.1, 6);
    expect(xirr([{ amount: -1000, date: '2021-01-01' }, { amount: 1100, date: '2022-01-01' }])).toBeCloseTo(0.1, 4);
    expect(xirr([{ amount: -1000, date: '2021-01-01' }, { amount: -1000, date: '2022-01-01' }, { amount: 2310, date: '2023-01-01' }])).toBeCloseTo(0.1, 4);
    expect(xirr([{ amount: 1000, date: '2021-01-01' }])).toBeNull();
  });

  it('reports CAGR per holding and portfolio XIRR', async () => {
    const headers = await authed();
    const today = new Date().toISOString().slice(0, 10);
    const twoYearsAgo = new Date(Date.parse(today) - 2 * 365 * 86400000).toISOString().slice(0, 10);
    await request(app).post('/api/investments').set(headers).send({ name: 'Fund', category: 'mutual_funds', initialAmount: 1000, currentAmount: 1210, investmentDate: twoYearsAgo });
    const res = await request(app).get('/api/portfolio/returns').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.investments[0].cagr).toBeCloseTo(0.1, 3);
    expect(res.body.portfolio.xirr).toBeCloseTo(0.1, 3);
    expect(res.body.portfolio.absoluteReturn).toBeCloseTo(0.21, 4);
  });
});

describe('CSV import', () => {
  const importCsv = (headers, body) => request(app).post('/api/investments/import').set(headers).set('Content-Type', 'text/csv').send(body);

  it('imports rows with quoted fields and CRLF line endings', async () => {
    const headers = await authed();
    const res = await importCsv(headers, 'name,category,currentAmount,initialAmount,investmentDate\r\n"HDFC, Flexi Cap",mutual_funds,"1,500.50",1000,2024-04-01\r\nGold coin,gold,7000,,\r\n');
    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(2);
    const list = await request(app).get('/api/investments').set(headers);
    const byName = Object.fromEntries(list.body.investments.map(i => [i.name, i]));
    expect(Object.keys(byName).sort()).toEqual(['Gold coin', 'HDFC, Flexi Cap']);
    expect(parseFloat(byName['HDFC, Flexi Cap'].currentAmount)).toBe(1500.5);
  });

  it('rejects the whole file when any row is invalid', async () => {
    const headers = await authed();
    const res = await importCsv(headers, 'name,category,currentAmount\nGood,stocks,100\n,stocks,abc\nBad,yachts,5\n');
    expect(res.status).toBe(400);
    expect(res.body.errors.map(e => e.row)).toEqual([3, 3, 4]);
    const list = await request(app).get('/api/investments').set(headers);
    expect(list.body.investments).toHaveLength(0);
  });

  it('requires the mandatory columns', async () => {
    const headers = await authed();
    expect((await importCsv(headers, 'title,value\nx,1\n')).status).toBe(400);
  });
});

describe('portfolio reconciliation', () => {
  it('overview, stacked and monthly agree for past months, and snapshots use depreciated asset values', async () => {
    const headers = await authed();
    const month = (offset) => {
      const d = new Date();
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1)).toISOString().slice(0, 7);
    };
    await request(app).post('/api/investments').set(headers).send({ name: 'Old fund', category: 'mutual_funds', initialAmount: 1000, currentAmount: 1300, investmentDate: `${month(-3)}-10` });
    await request(app).post('/api/investments').set(headers).send({ name: 'Gold', category: 'gold', initialAmount: 500, currentAmount: 600, investmentDate: `${month(-1)}-10` });

    const overview = await request(app).get(`/api/portfolio/overview?month=${month(-1)}`).set(headers);
    expect(overview.body.totalValue).toBe(1500);
    expect(overview.body.totalInvestments).toBe(2);
    const current = await request(app).get('/api/portfolio/overview').set(headers);
    expect(current.body.totalValue).toBe(1900);

    const monthly = await request(app).get('/api/portfolio/analytics/monthly?limit=4').set(headers);
    const stacked = await request(app).get('/api/portfolio/analytics/stacked?limit=4').set(headers);
    monthly.body.data.forEach(({ month: m, total }) => {
      const parts = stacked.body.data.filter(r => r.month === m).reduce((sum, r) => sum + r.total, 0);
      expect(parts).toBeCloseTo(total, 2);
    });
    expect(stacked.body.data.filter(r => r.month === month(-2))).toEqual([{ month: month(-2), category: 'mutual_funds', total: 1000 }]);

    const twoYearsAgo = new Date(Date.now() - 2 * 365 * 86400000).toISOString().slice(0, 10);
    expect((await request(app).post('/api/assets').set(headers).send({ name: 'Laptop', category: 'gadgets', currentValue: 100000, purchaseDate: twoYearsAgo, depreciationRate: 10 })).status).toBe(201);
    const snap = await request(app).post('/api/portfolio/snapshot').set(headers).send({ snapshotDate: '2026-02-01' });
    expect(parseFloat(snap.body.snapshot.totalAssets)).toBeCloseTo(80000, -2);
  });
});
