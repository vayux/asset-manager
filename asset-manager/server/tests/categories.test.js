const request = require('supertest');
const app = require('../index');
const { sequelize } = require('../config/database');
const { Investment, Asset } = require('../models');
const { resetDatabase } = require('./db');

let headers;
let userId;

beforeAll(async () => {
  await resetDatabase();
  const res = await request(app).post('/api/auth/register').send({
    email: 'categories@example.com', password: 'Passw0rd!x', firstName: 'Cat', lastName: 'Egory',
  });
  headers = { Authorization: `Bearer ${res.body.accessToken}` };
  userId = res.body.user.id;
});

afterAll(() => sequelize.close());

describe('retired categories', () => {
  it('rejects new personal_loan investments and stocks assets', async () => {
    const inv = await request(app).post('/api/investments').set(headers)
      .send({ name: 'Loan to friend', category: 'personal_loan', currentAmount: 1000 });
    expect(inv.status).toBe(400);
    expect(JSON.stringify(inv.body)).toMatch(/Liabilities/);

    const asset = await request(app).post('/api/assets').set(headers)
      .send({ name: 'Shares', category: 'stocks', currentValue: 1000 });
    expect(asset.status).toBe(400);
    expect(JSON.stringify(asset.body)).toMatch(/Investments/);
  });

  it('keeps existing rows with retired categories readable and editable', async () => {
    const loan = await Investment.create({ userId, name: 'Old loan', category: 'personal_loan', currentAmount: 500 });
    const shares = await Asset.create({ userId, name: 'Old shares', category: 'stocks', currentValue: 700 });

    const list = await request(app).get('/api/investments').set(headers);
    expect(list.body.investments.map(i => i.category)).toContain('personal_loan');

    const upd = await request(app).put(`/api/investments/${loan.id}`).set(headers)
      .send({ category: 'personal_loan', currentAmount: 600 });
    expect(upd.status).toBe(200);
    expect(Number(upd.body.investment.currentAmount)).toBe(600);

    const assetUpd = await request(app).put(`/api/assets/${shares.id}`).set(headers).send({ name: 'Old shares (demat)' });
    expect(assetUpd.status).toBe(200);
  });

  it('does not let another row switch into a retired category', async () => {
    const fd = await request(app).post('/api/investments').set(headers)
      .send({ name: 'FD', category: 'fixed_deposit', currentAmount: 1000 });
    const res = await request(app).put(`/api/investments/${fd.body.investment.id}`).set(headers).send({ category: 'personal_loan' });
    expect(res.status).toBe(400);

    const car = await request(app).post('/api/assets').set(headers).send({ name: 'Car', category: 'vehicle', currentValue: 5000 });
    const res2 = await request(app).put(`/api/assets/${car.body.asset.id}`).set(headers).send({ category: 'stocks' });
    expect(res2.status).toBe(400);
  });

  it('rejects personal_loan rows in CSV import', async () => {
    const csv = 'name,currentAmount,category\nLoan,100,personal_loan\n';
    const res = await request(app).post('/api/investments/import').set(headers).set('Content-Type', 'text/csv').send(csv);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/Liabilities/);
  });
});
