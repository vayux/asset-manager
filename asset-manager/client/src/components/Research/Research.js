import React, { useState } from 'react';
import { ArrowTopRightOnSquareIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
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

const StockTable = ({ rows }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200 text-sm">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-2 text-left font-medium text-gray-500">#</th>
          <th className="px-4 py-2 text-left font-medium text-gray-500">Company</th>
          <th className="px-4 py-2 text-left font-medium text-gray-500">Sector</th>
          <th className="px-4 py-2 text-left font-medium text-gray-500">Why research it</th>
          <th className="px-4 py-2 text-left font-medium text-gray-500">Live quote</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map((row, index) => (
          <tr key={row.symbol}>
            <td className="px-4 py-2 text-gray-500">{index + 1}</td>
            <td className="px-4 py-2">
              <div className="font-medium text-gray-900">{row.name}</div>
              <div className="text-xs text-gray-500">NSE: {row.symbol}</div>
            </td>
            <td className="px-4 py-2 text-gray-700">{row.sector}</td>
            <td className="px-4 py-2 text-gray-700">{row.thesis}</td>
            <td className="px-4 py-2">
              <a href={quoteUrl(row.symbol)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center text-primary-600 hover:text-primary-500">
                NSE <ArrowTopRightOnSquareIcon className="h-4 w-4 ml-1" />
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Research = () => {
  const [tab, setTab] = useState('long');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Research</h2>
        <p className="text-sm text-gray-600">Stock ideas to research by holding period. Last reviewed {LAST_REVIEWED}.</p>
      </div>

      <div className="flex items-start rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
        <ExclamationTriangleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
        <span>
          Educational watchlists, not buy recommendations. Prices and valuations are not shown here and change daily —
          check them and the checklist below before investing, and consult a SEBI-registered investment adviser for personal advice.
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
        {tab === 'long' && <StockTable rows={LONG_TERM} />}
        {tab === 'mid' && <StockTable rows={MID_TERM} />}
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
