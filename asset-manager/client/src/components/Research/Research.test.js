import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import api from '../../api/client';
import { createQueryClient } from '../../api/queryClient';
import Research from './Research';

vi.mock('../../api/client', () => ({ default: { get: vi.fn() } }));

const renderPage = () => render(
  <QueryClientProvider client={createQueryClient({ retry: false })}><Research /></QueryClientProvider>
);

const quote = (price, change, changePercent) => ({ price, change, changePercent, previousClose: price - change, fiftyTwoWeekLow: 600, fiftyTwoWeekHigh: 1000 });

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(url => Promise.resolve({ data: {
    quotes: url.includes('HDFCBANK')
      ? { HDFCBANK: quote(692.8, 9.5, 1.39) }
      : { 'M&M': quote(3000, -100, -3.23) },
    unavailable: url.includes('HDFCBANK') ? ['TCS'] : [],
    source: 'Yahoo Finance',
    fetchedAt: '2026-10-31T10:00:00.000Z',
  } }));
});

it('shows ten ideas per horizon with live prices, rules for short term, and a disclaimer', async () => {
  renderPage();
  expect(screen.getByText(/not buy recommendations/i)).toBeInTheDocument();
  expect(screen.getAllByText(/^NSE: /)).toHaveLength(10);
  expect(await screen.findByText('₹692.80')).toBeInTheDocument();
  expect(screen.getByText('+9.50 (+1.39%)')).toBeInTheDocument();
  expect(screen.getByText(/No price for TCS/)).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/research\/quotes\?symbols=HDFCBANK,ICICIBANK,/));

  await userEvent.click(screen.getByRole('tab', { name: /mid term/i }));
  expect(screen.getAllByText(/^NSE: /)).toHaveLength(10);
  expect(await screen.findByText('-100.00 (-3.23%)')).toBeInTheDocument();
  expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining('M%26M'));
  const hrefs = screen.getAllByRole('link', { name: /nse/i }).map(link => link.getAttribute('href'));
  expect(hrefs).toContain('https://www.nseindia.com/get-quotes/equity?symbol=M%26M');

  const calls = api.get.mock.calls.length;
  await userEvent.click(screen.getByRole('tab', { name: /short term/i }));
  expect(screen.queryAllByText(/^NSE: /)).toHaveLength(0);
  expect(screen.getByText(/stop-loss/i)).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(calls);
});

it('keeps the page usable when the price service fails', async () => {
  api.get.mockRejectedValue(new Error('down'));
  renderPage();
  expect(await screen.findByText(/Live prices are unavailable/)).toBeInTheDocument();
  expect(screen.getByText('HDFC Bank')).toBeInTheDocument();
});
