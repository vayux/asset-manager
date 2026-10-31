const request = require('supertest');
const app = require('../index');
const { sequelize } = require('../config/database');

if (!process.env.DB_NAME.endsWith('_test')) {
  throw new Error(`Refusing to run tests against non-test database "${process.env.DB_NAME}"`);
}

const register = async (name) => {
  const res = await request(app).post('/api/auth/register').send({
    email: `${name}@example.com`,
    password: 'Passw0rd!x',
    firstName: 'Test',
    lastName: 'User',
  });
  expect(res.status).toBe(201);
  return { token: res.body.accessToken, id: res.body.user.id };
};

const auth = (user) => ({ Authorization: `Bearer ${user.token}` });

let alice;
let bob;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  alice = await register('alice');
  bob = await register('bob');
});

afterAll(async () => {
  await sequelize.close();
});

describe('error handling', () => {
  it.each([
    ['put', '/api/goals/not-a-uuid'],
    ['delete', '/api/goals/not-a-uuid'],
    ['put', '/api/budget/categories/not-a-uuid'],
    ['delete', '/api/budget/categories/not-a-uuid'],
    ['put', '/api/income/not-a-uuid'],
    ['delete', '/api/income/not-a-uuid'],
    ['get', '/api/assets/not-a-uuid/valuations'],
  ])('%s %s returns 400 instead of crashing', async (method, url) => {
    const res = await request(app)[method](url).set(auth(alice)).send({});
    expect(res.status).toBe(400);
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/goals')
      .set(auth(alice))
      .set('Content-Type', 'application/json')
      .send('{"name":');
    expect(res.status).toBe(400);
  });

  it('routes /summary/category to the summary handler', async () => {
    const res = await request(app).get('/api/investments/summary/category').set(auth(alice));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
  });
});

describe('mass assignment', () => {
  const cases = [
    ['investments', { name: 'FD', category: 'fixed_deposit', currentAmount: 1000 }, 'investment', 'investments'],
    ['assets', { name: 'Car', category: 'vehicle', currentValue: 5000 }, 'asset', 'assets'],
    ['liabilities', { name: 'Loan', category: 'loan', outstandingAmount: 100 }, 'liability', 'liabilities'],
    ['goals', { name: 'House', targetAmount: 100000, targetDate: '2030-01-01' }, 'goal', 'goals'],
    ['income', { name: 'Salary', amount: 100, frequency: 'monthly', nextPayDate: '2030-01-01' }, 'income', 'incomes'],
  ];

  it.each(cases)('%s: create and update ignore userId', async (resource, payload, key, listKey) => {
    const created = await request(app)
      .post(`/api/${resource}`)
      .set(auth(alice))
      .send({ ...payload, userId: bob.id });
    expect(created.status).toBe(201);
    const record = created.body[key];
    expect(record.userId).toBe(alice.id);

    const updated = await request(app)
      .put(`/api/${resource}/${record.id}`)
      .set(auth(alice))
      .send({ userId: bob.id, name: 'Renamed' });
    expect(updated.status).toBe(200);
    expect(updated.body[key].userId).toBe(alice.id);
    expect(updated.body[key].name).toBe('Renamed');

    const bobList = await request(app).get(`/api/${resource}`).set(auth(bob));
    expect(bobList.body[listKey]).toHaveLength(0);
  });

  it('rejects linking a liability to another user\'s asset', async () => {
    const bobAsset = await request(app)
      .post('/api/assets')
      .set(auth(bob))
      .send({ name: 'Bob house', category: 'real_estate', currentValue: 1 });
    const res = await request(app)
      .post('/api/liabilities')
      .set(auth(alice))
      .send({ name: 'Loan', category: 'loan', outstandingAmount: 1, assetId: bobAsset.body.asset.id });
    expect(res.status).toBe(400);
  });

  it('rejects budget entries for another user\'s category', async () => {
    const bobCat = await request(app)
      .post('/api/budget/categories')
      .set(auth(bob))
      .send({ name: 'Food', frameworkTag: 'need' });
    const res = await request(app)
      .post('/api/budget/entries')
      .set(auth(alice))
      .send({ categoryId: bobCat.body.category.id, month: '2026-10-01', budgetedAmount: 10 });
    expect(res.status).toBe(404);
  });
});

describe('ownership checks', () => {
  it('does not expose another user\'s investment history', async () => {
    const inv = await request(app)
      .post('/api/investments')
      .set(auth(bob))
      .send({ name: 'Stocks', category: 'stocks', currentAmount: 10 });
    await request(app)
      .post(`/api/investments/${inv.body.investment.id}/value`)
      .set(auth(bob))
      .send({ amount: 20, valuationDate: '2026-10-01' });

    const res = await request(app).get(`/api/investments/${inv.body.investment.id}/history`).set(auth(alice));
    expect(res.status).toBe(404);

    const own = await request(app).get(`/api/investments/${inv.body.investment.id}/history`).set(auth(bob));
    expect(own.status).toBe(200);
    expect(own.body.histories).toHaveLength(1);
  });
});

describe('input bounds', () => {
  let goalId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/goals')
      .set(auth(alice))
      .send({ name: 'Far future', targetAmount: 1000, targetDate: '9999-01-01' });
    goalId = res.body.goal.id;
  });

  it('rejects huge projection month counts', async () => {
    const res = await request(app).get(`/api/goals/${goalId}/projection?months=100000000`).set(auth(alice));
    expect(res.status).toBe(400);
  });

  it('caps projections for far-future target dates', async () => {
    const linear = await request(app).get(`/api/goals/${goalId}/projection`).set(auth(alice));
    expect(linear.status).toBe(200);
    expect(linear.body.projection).toHaveLength(601);

    const mc = await request(app).get(`/api/goals/${goalId}/projection/montecarlo?sims=100`).set(auth(alice));
    expect(mc.status).toBe(200);
    expect(mc.body.percentiles).toHaveLength(601);
  });

  it.each([
    '/api/investments?month=foo',
    '/api/portfolio/overview?month=2026-13',
    '/api/portfolio/analytics/monthly?limit=100000',
    '/api/portfolio/analytics/stacked?limit=100000',
    '/api/optimizer/health?month=bad',
    '/api/optimizer/recommendations?month=bad',
    '/api/budget/entries?month=bad',
    '/api/budget/entries',
  ])('GET %s returns 400', async (url) => {
    const res = await request(app).get(url).set(auth(alice));
    expect(res.status).toBe(400);
  });

  it('still accepts valid month and limit params', async () => {
    const urls = [
      '/api/investments?month=2026-10',
      '/api/portfolio/overview?month=2026-10',
      '/api/portfolio/analytics/stacked?limit=6',
      '/api/optimizer/health?month=2026-10',
      '/api/budget/entries?month=2026-10',
    ];
    for (const url of urls) {
      const res = await request(app).get(url).set(auth(alice));
      expect(res.status).toBe(200);
    }
  });
});
