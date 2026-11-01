const request = require('supertest');
const app = require('../index');
const { sequelize } = require('../config/database');
const { resetDatabase } = require('./db');
const { clearRateCache } = require('../services/fx');
const { buildSnapshot } = require('../services/snapshots');

const ok = (json) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(json) });
const fail = () => Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) });
const yahoo = (price) => ok({ chart: { result: [{ meta: { regularMarketPrice: price } }] } });

let headers;
let userId;
const realFetch = global.fetch;

// USD from Yahoo, EUR only from the ECB fallback, GBP from nowhere
const fakeFetch = (url) => {
  if (url.includes('USDINR')) return yahoo(83.5);
  if (url.includes('frankfurter') && url.includes('from=EUR')) return ok({ rates: { INR: 90.25 } });
  return fail();
};

beforeAll(async () => {
  await resetDatabase();
  const res = await request(app).post('/api/auth/register').send({
    email: 'fx@example.com', password: 'Passw0rd!x', firstName: 'Fx', lastName: 'User',
  });
  headers = { Authorization: `Bearer ${res.body.accessToken}` };
  userId = res.body.user.id;
});

beforeEach(() => {
  clearRateCache();
  global.fetch = jest.fn(fakeFetch);
});

afterAll(async () => {
  global.fetch = realFetch;
  await sequelize.close();
});

describe('multi-currency', () => {
  it('rejects unsupported currencies', async () => {
    const res = await request(app).post('/api/investments').set(headers)
      .send({ name: 'Bad', category: 'stocks', currentAmount: 10, currency: 'XYZ' });
    expect(res.status).toBe(400);
  });

  it('stores the currency and converts list amounts to INR', async () => {
    const inv = await request(app).post('/api/investments').set(headers)
      .send({ name: 'US index fund', category: 'mutual_funds', currentAmount: 100, currency: 'USD' });
    expect(inv.status).toBe(201);
    expect(inv.body.investment.currency).toBe('USD');

    await request(app).post('/api/assets').set(headers).send({ name: 'Paris flat', category: 'real_estate', currentValue: 1000, currency: 'EUR' });
    await request(app).post('/api/liabilities').set(headers).send({ name: 'UK card', category: 'credit_card', outstandingAmount: 10, currency: 'GBP' });

    const list = await request(app).get('/api/investments').set(headers);
    expect(list.body.investments[0].amountInr).toBe(8350);
    const assets = await request(app).get('/api/assets').set(headers);
    expect(assets.body.assets[0].valueInr).toBe(90250);
  });

  it('falls back to manual rates and reports currencies with no rate', async () => {
    let rates = await request(app).get('/api/fx/rates').set(headers);
    expect(rates.body.rates.USD).toMatchObject({ rate: 83.5, source: 'Yahoo Finance' });
    expect(rates.body.rates.EUR).toMatchObject({ rate: 90.25, source: 'ECB (frankfurter.app)' });
    expect(rates.body.missing).toEqual(['GBP']);

    const put = await request(app).put('/api/fx/rates/gbp').set(headers).send({ rate: 105 });
    expect(put.status).toBe(200);
    rates = await request(app).get('/api/fx/rates').set(headers);
    expect(rates.body.rates.GBP).toMatchObject({ rate: 105, source: 'manual' });
    expect(rates.body.missing).toEqual([]);

    expect((await request(app).put('/api/fx/rates/INR').set(headers).send({ rate: 2 })).status).toBe(400);
    expect((await request(app).put('/api/fx/rates/USD').set(headers).send({ rate: -1 })).status).toBe(400);
  });

  it('values snapshots in INR', async () => {
    const snap = await buildSnapshot(userId);
    expect(snap.totalValue).toBe(8350);
    expect(snap.totalAssets).toBe(90250);
    expect(snap.totalLiabilities).toBe(1050);
    expect(snap.netWorth).toBe(8350 + 90250 - 1050);
  });

  it('only lets a user delete their own manual rate', async () => {
    const other = await request(app).post('/api/auth/register').send({
      email: 'fx2@example.com', password: 'Passw0rd!x', firstName: 'Other', lastName: 'User',
    });
    const res = await request(app).delete('/api/fx/rates/GBP').set({ Authorization: `Bearer ${other.body.accessToken}` });
    expect(res.status).toBe(404);
    expect((await request(app).delete('/api/fx/rates/GBP').set(headers)).status).toBe(200);
  });
});
