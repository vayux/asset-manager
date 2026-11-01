import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import { ArrowPathIcon, ArrowTopRightOnSquareIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { CHECKLIST, LAST_REVIEWED, LONG_TERM, MID_TERM, SHORT_TERM_RULES, quoteUrl } from './researchData';

const TABS = [
  { id: 'long', label: 'Long term (5+ years)' },
  { id: 'mid', label: 'Mid term (1–3 years)' },
  { id: 'short', label: 'Short term (< 1 year)' },
];

const INTRO = {
  long: 'Build the core with a low-cost Nifty 50 / Next 50 index fund; over long periods most active stock pickers fail to beat it. For individual stocks, look for steady compounders: high return on equity, low debt and a durable market position.',
  mid: 'These are sector and cycle bets, so the price you pay matters much more. Many of these names have already rallied — check the P/E against the stock’s own history before buying.',
  short: 'Over months, prices move mostly on news and momentum, which no one can predict reliably, so there is no stock list here. If you trade, follow these rules.',
};

const price = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatPrice = (n) => (n == null ? '—' : price.format(n));

const DayChange = ({ quote }) => {
  if (!quote || quote.change == null) return <span className="text-gray-400">—</span>;
  const up = quote.change >= 0;
  return (
    <span className={up ? 'text-green-600' : 'text-red-600'}>
      {up ? '+' : ''}{quote.change.toFixed(2)} ({up ? '+' : ''}{quote.changePercent.toFixed(2)}%)
    </span>
  );
};

const StockTable = ({ rows, quotes, loading }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200 text-sm">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-2 text-left font-medium text-gray-500">#</th>
          <th className="px-4 py-2 text-left font-medium text-gray-500">Company</th>
          <th className="px-4 py-2 text-left font-medium text-gray-500">Sector</th>
          <th className="px-4 py-2 text-right font-medium text-gray-500">Price</th>
          <th className="px-4 py-2 text-right font-medium text-gray-500">Day change</th>
          <th className="px-4 py-2 text-right font-medium text-gray-500 whitespace-nowrap">52-week range</th>
          <th className="px-4 py-2 text-left font-medium text-gray-500">Why research it</th>
          <th className="px-4 py-2 text-left font-medium text-gray-500">Live quote</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map((row, index) => {
          const quote = quotes[row.symbol];
          return (
          <tr key={row.symbol}>
            <td className="px-4 py-2 text-gray-500">{index + 1}</td>
            <td className="px-4 py-2">
              <div className="font-medium text-gray-900">{row.name}</div>
              <div className="text-xs text-gray-500">NSE: {row.symbol}</div>
            </td>
            <td className="px-4 py-2 text-gray-700">{row.sector}</td>
            <td className="px-4 py-2 text-right font-medium text-gray-900 whitespace-nowrap" data-testid={`price-${row.symbol}`}>
              {quote ? formatPrice(quote.price) : <span className="text-gray-400">{loading ? '…' : '—'}</span>}
            </td>
            <td className="px-4 py-2 text-right whitespace-nowrap"><DayChange quote={quote} /></td>
            <td className="px-4 py-2 text-right text-gray-600 whitespace-nowrap">
              {quote?.fiftyTwoWeekLow != null ? `${formatPrice(quote.fiftyTwoWeekLow)} – ${formatPrice(quote.fiftyTwoWeekHigh)}` : '—'}
            </td>
            <td className="px-4 py-2 text-gray-700">{row.thesis}</td>
            <td className="px-4 py-2">
              <a href={quoteUrl(row.symbol)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center text-primary-600 hover:text-primary-500">
                NSE <ArrowTopRightOnSquareIcon className="h-4 w-4 ml-1" />
              </a>
            </td>
          </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const Research = () => {
  const [tab, setTab] = useState('long');
  const rows = tab === 'long' ? LONG_TERM : tab === 'mid' ? MID_TERM : null;

  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ['research-quotes', tab],
    queryFn: async () => {
      const symbols = rows.map(r => encodeURIComponent(r.symbol)).join(',');
      return (await api.get(`/api/research/quotes?symbols=${symbols}`)).data;
    },
    enabled: Boolean(rows),
    staleTime: 60 * 1000,
  });
  const quotes = data?.quotes || {};
  const loading = isFetching;
  const meta = data && { source: data.source, fetchedAt: data.fetchedAt, unavailable: data.unavailable };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Research</h2>
        <p className="text-sm text-gray-600">Stock ideas to research by holding period. Last reviewed {LAST_REVIEWED}.</p>
      </div>

      <div className="flex items-start rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
        <ExclamationTriangleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
        <span>
          Educational watchlists, not buy recommendations. Prices change constantly and a price alone says nothing about valuation —
          check the checklist below before investing, and consult a SEBI-registered investment adviser for personal advice.
        </span>
      </div>

      <div className="border-b border-gray-200" role="tablist">
        <nav className="-mb-px flex space-x-6">
          {TABS.map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`py-2 px-1 border-b-2 text-sm font-medium ${tab === t.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="card space-y-4">
        <p className="text-sm text-gray-700">{INTRO[tab]}</p>
        {rows && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
              <span>
                {(error && 'Live prices are unavailable right now.') || (meta
                  ? `Prices from ${meta.source}, may be delayed up to 15 minutes. Updated ${new Date(meta.fetchedAt).toLocaleTimeString('en-IN')}.`
                  : 'Loading live prices…')}
                {meta?.unavailable?.length ? ` No price for ${meta.unavailable.join(', ')}.` : ''}
              </span>
              <button type="button" onClick={() => refetch()} disabled={loading}
                className="inline-flex items-center text-primary-600 hover:text-primary-500 disabled:opacity-50">
                <ArrowPathIcon className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh prices
              </button>
            </div>
            <StockTable rows={rows} quotes={quotes} loading={loading} />
          </>
        )}
        {tab === 'short' && (
          <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
            {SHORT_TERM_RULES.map(rule => <li key={rule}>{rule}</li>)}
          </ol>
        )}
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Checklist before buying any stock</h3>
        <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
          {CHECKLIST.map(item => <li key={item}>{item}</li>)}
        </ul>
      </div>
    </div>
  );
};

export default Research;
