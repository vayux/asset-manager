const request = require('supertest');
const app = require('../index');
const { sequelize } = require('../config/database');
const { resetDatabase } = require('./db');
const { clearQuoteCache } = require('../utils/quotes');

const chart = (price, previousClose) => ({
  chart: { result: [{ meta: {
    currency: 'INR', regularMarketPrice: price, chartPreviousClose: previousClose,
    fiftyTwoWeekHigh: 1000, fiftyTwoWeekLow: 600, regularMarketTime: 1793354303,
  } }] },
});
const ok = (json) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(json) });

let headers;
const realFetch = global.fetch;

beforeAll(async () => {
  await resetDatabase();
  const res = await request(app).post('/api/auth/register').send({
    email: 'research@example.com', password: 'Passw0rd!x', firstName: 'Re', lastName: 'Search',
  });
  headers = { Authorization: `Bearer ${res.body.accessToken}` };
});

beforeEach(() => {
  clearQuoteCache();
  global.fetch = jest.fn();
});

afterAll(async () => {
  global.fetch = realFetch;
  await sequelize.close();
});

describe('GET /api/research/quotes', () => {
  it('requires login', async () => {
    const res = await request(app).get('/api/research/quotes?symbols=TCS');
    expect(res.status).toBe(401);
  });

  it('returns price and day change per NSE symbol', async () => {
    global.fetch.mockImplementation(url => ok(url.includes('M%26M.NS') ? chart(3000, 3100) : chart(692.8, 683.3)));
    const res = await request(app).get('/api/research/quotes?symbols=HDFCBANK,M%26M').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.quotes.HDFCBANK).toMatchObject({ price: 692.8, previousClose: 683.3, change: 9.5, changePercent: 1.39, currency: 'INR' });
    expect(res.body.quotes['M&M']).toMatchObject({ price: 3000, change: -100, changePercent: -3.23 });
    expect(res.body.unavailable).toEqual([]);
    expect(global.fetch.mock.calls.map(c => c[0])).toEqual(expect.arrayContaining([expect.stringContaining('/HDFCBANK.NS?')]));
  });

  it('caches quotes so repeat requests do not refetch', async () => {
    global.fetch.mockImplementation(() => ok(chart(100, 90)));
    await request(app).get('/api/research/quotes?symbols=TCS').set(headers);
    await request(app).get('/api/research/quotes?symbols=TCS').set(headers);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('reports symbols the source could not price without failing the rest', async () => {
    global.fetch.mockImplementation(url => (url.includes('INFY')
      ? Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
      : ok(chart(100, 90))));
    const res = await request(app).get('/api/research/quotes?symbols=TCS,INFY').set(headers);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.quotes)).toEqual(['TCS']);
    expect(res.body.unavailable).toEqual(['INFY']);
  });

  it.each([
    ['missing symbols', ''],
    ['lowercase / URL-like symbol', '?symbols=http://evil'],
    ['too many symbols', `?symbols=${Array.from({ length: 26 }, (_, i) => `S${i}`).join(',')}`],
  ])('rejects %s', async (_label, qs) => {
    const res = await request(app).get(`/api/research/quotes${qs}`).set(headers);
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
