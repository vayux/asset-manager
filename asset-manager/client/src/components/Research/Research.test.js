import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import Research from './Research';

jest.mock('axios', () => ({ get: jest.fn() }));

const quote = (price, change, changePercent) => ({ price, change, changePercent, previousClose: price - change, fiftyTwoWeekLow: 600, fiftyTwoWeekHigh: 1000 });

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockImplementation(url => Promise.resolve({ data: {
    quotes: url.includes('HDFCBANK')
      ? { HDFCBANK: quote(692.8, 9.5, 1.39) }
      : { 'M&M': quote(3000, -100, -3.23) },
    unavailable: url.includes('HDFCBANK') ? ['TCS'] : [],
    source: 'Yahoo Finance',
    fetchedAt: '2026-10-31T10:00:00.000Z',
  } }));
});

it('shows ten ideas per horizon with live prices, rules for short term, and a disclaimer', async () => {
  render(<Research />);
  expect(screen.getByText(/not buy recommendations/i)).toBeInTheDocument();
  expect(screen.getAllByText(/^NSE: /)).toHaveLength(10);
  expect(await screen.findByText('₹692.80')).toBeInTheDocument();
  expect(screen.getByText('+9.50 (+1.39%)')).toBeInTheDocument();
  expect(screen.getByText(/No price for TCS/)).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/research\/quotes\?symbols=HDFCBANK,ICICIBANK,/));

  await userEvent.click(screen.getByRole('tab', { name: /mid term/i }));
  expect(screen.getAllByText(/^NSE: /)).toHaveLength(10);
  expect(await screen.findByText('-100.00 (-3.23%)')).toBeInTheDocument();
  expect(axios.get).toHaveBeenLastCalledWith(expect.stringContaining('M%26M'));
  const hrefs = screen.getAllByRole('link', { name: /nse/i }).map(link => link.getAttribute('href'));
  expect(hrefs).toContain('https://www.nseindia.com/get-quotes/equity?symbol=M%26M');

  const calls = axios.get.mock.calls.length;
  await userEvent.click(screen.getByRole('tab', { name: /short term/i }));
  expect(screen.queryAllByText(/^NSE: /)).toHaveLength(0);
  expect(screen.getByText(/stop-loss/i)).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledTimes(calls);
});

it('keeps the page usable when the price service fails', async () => {
  axios.get.mockRejectedValue(new Error('down'));
  render(<Research />);
  expect(await screen.findByText(/Live prices are unavailable/)).toBeInTheDocument();
  expect(screen.getByText('HDFC Bank')).toBeInTheDocument();
});
