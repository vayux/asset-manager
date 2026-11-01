const { ExchangeRate } = require('../models');
const logger = require('../utils/logger');
const { money, toAmount } = require('../utils/money');
const { BASE_CURRENCY } = require('../constants/currencies');

const CACHE_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const cache = new Map();

const getJson = async (url) => {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (MoneyMind)', Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
};

const SOURCES = [
  {
    name: 'Yahoo Finance',
    fetchRate: async (currency) => {
      const json = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${currency}INR%3DX?range=1d&interval=1d`);
      return Number(json?.chart?.result?.[0]?.meta?.regularMarketPrice);
    },
  },
  {
    name: 'ECB (frankfurter.app)',
    fetchRate: async (currency) => {
      const json = await getJson(`https://api.frankfurter.app/latest?from=${currency}&to=INR`);
      return Number(json?.rates?.INR);
    },
  },
];

const fetchLiveRate = async (currency) => {
  for (const source of SOURCES) {
    try {
      const rate = await source.fetchRate(currency);
      if (Number.isFinite(rate) && rate > 0) return { rate, source: source.name, asOf: new Date().toISOString() };
    } catch (err) {
      logger.warn({ err: err.message, currency, source: source.name }, 'FX source failed');
    }
  }
  return null;
};

// Shared by all users; failures are not cached so the next request retries
const getLiveRate = (currency, now = Date.now()) => {
  const hit = cache.get(currency);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.promise;
  const promise = fetchLiveRate(currency);
  cache.set(currency, { at: now, promise });
  promise.then((r) => { if (!r) cache.delete(currency); });
  return promise;
};

const clearRateCache = () => cache.clear();

// Live rate first, then the user's manual rate. Currencies with neither come back in `missing`.
const getRates = async (userId, currencies) => {
  const wanted = [...new Set(currencies.filter(c => c && c !== BASE_CURRENCY))];
  const rates = { [BASE_CURRENCY]: { rate: 1, source: 'base' } };
  if (!wanted.length) return { rates, missing: [] };
  const [live, manual] = await Promise.all([
    Promise.all(wanted.map(c => getLiveRate(c))),
    ExchangeRate.findAll({ where: { userId, currency: wanted }, raw: true }),
  ]);
  const manualBy = Object.fromEntries(manual.map(m => [m.currency, m]));
  const missing = [];
  wanted.forEach((currency, i) => {
    if (live[i]) rates[currency] = live[i];
    else if (manualBy[currency]) {
      rates[currency] = { rate: Number(manualBy[currency].rateToInr), source: 'manual', asOf: manualBy[currency].updatedAt };
    } else missing.push(currency);
  });
  return { rates, missing };
};

// Returns convert(amount, currency) -> INR. Amounts in a currency with no rate are left unconverted.
const converterFor = async (userId, rows) => {
  const { rates, missing } = await getRates(userId, rows.map(r => r.currency));
  const convert = (amount, currency = BASE_CURRENCY) => {
    const r = rates[currency || BASE_CURRENCY];
    return r ? money(amount).times(r.rate).toDecimalPlaces(2).toNumber() : toAmount(amount);
  };
  convert.rates = rates;
  convert.missing = missing;
  return convert;
};

module.exports = { getRates, converterFor, clearRateCache, SOURCES };
