import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Research from './Research';

it('shows ten ideas per horizon, trading rules for short term, and a disclaimer', async () => {
  render(<Research />);
  expect(screen.getByText(/not buy recommendations/i)).toBeInTheDocument();
  expect(screen.getAllByText(/^NSE: /)).toHaveLength(10);
  expect(screen.getByText('HDFC Bank')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('tab', { name: /mid term/i }));
  expect(screen.getAllByText(/^NSE: /)).toHaveLength(10);
  expect(screen.getByText('Larsen & Toubro')).toBeInTheDocument();
  const hrefs = screen.getAllByRole('link', { name: /nse/i }).map(link => link.getAttribute('href'));
  expect(hrefs).toContain('https://www.nseindia.com/get-quotes/equity?symbol=M%26M');

  await userEvent.click(screen.getByRole('tab', { name: /short term/i }));
  expect(screen.queryAllByText(/^NSE: /)).toHaveLength(0);
  expect(screen.getByText(/stop-loss/i)).toBeInTheDocument();
});
