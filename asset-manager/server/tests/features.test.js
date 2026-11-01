const request = require('supertest');
const app = require('../index');
const { sequelize } = require('../config/database');
const { resetDatabase } = require('./db');
const { Investment } = require('../models');
const emailService = require('../utils/emailService');

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
