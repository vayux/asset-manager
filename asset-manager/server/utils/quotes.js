const logger = require('./logger');

const CACHE_TTL_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const SYMBOL_RE = /^[A-Z0-9&-]{1,20}$/;
const SOURCE = 'Yahoo Finance';

const cache = new Map();

const chartUrl = (symbol) => `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(`${symbol}.NS`)}?range=1d&interval=1d`;

const round2 = (n) => Math.round(n * 100) / 100;

const parseChart = (json) => {
  const meta = json?.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice);
  if (!Number.isFinite(price)) return null;
  const previousClose = Number(meta.chartPreviousClose ?? meta.previousClose);
  const hasPrev = Number.isFinite(previousClose) && previousClose > 0;
  return {
    price,
    previousClose: hasPrev ? previousClose : null,
    change: hasPrev ? round2(price - previousClose) : null,
    changePercent: hasPrev ? round2(((price - previousClose) / previousClose) * 100) : null,
    fiftyTwoWeekHigh: Number.isFinite(meta.fiftyTwoWeekHigh) ? meta.fiftyTwoWeekHigh : null,
    fiftyTwoWeekLow: Number.isFinite(meta.fiftyTwoWeekLow) ? meta.fiftyTwoWeekLow : null,
    currency: meta.currency || 'INR',
    marketTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
  };
};

const fetchQuote = async (symbol) => {
  const res = await fetch(chartUrl(symbol), {
    headers: { 'User-Agent': 'Mozilla/5.0 (MoneyMind)', Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Quote source returned ${res.status}`);
  const quote = parseChart(await res.json());
  if (!quote) throw new Error('Quote source returned no price');
  return quote;
};

// Cached per symbol; concurrent requests for the same symbol share one upstream fetch
const getQuote = (symbol, now = Date.now()) => {
  const hit = cache.get(symbol);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.promise;
  const promise = fetchQuote(symbol);
  cache.set(symbol, { at: now, promise });
  promise.catch(() => cache.delete(symbol));
  return promise;
};

const getQuotes = async (symbols) => {
  const settled = await Promise.allSettled(symbols.map(s => getQuote(s)));
  const quotes = {};
  const unavailable = [];
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      quotes[symbols[i]] = result.value;
    } else {
      unavailable.push(symbols[i]);
      logger.warn({ symbol: symbols[i], err: result.reason?.message }, 'Quote fetch failed');
    }
  });
  return { quotes, unavailable, source: SOURCE, fetchedAt: new Date().toISOString() };
};

const clearQuoteCache = () => cache.clear();

module.exports = { SYMBOL_RE, getQuotes, parseChart, clearQuoteCache };
