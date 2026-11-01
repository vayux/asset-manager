import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import api from '../../api/client';
import { createQueryClient } from '../../api/queryClient';
import ExchangeRates from './ExchangeRates';

vi.mock('../../api/client', () => ({ default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

const renderRates = () => render(
  <QueryClientProvider client={createQueryClient({ retry: false })}><ExchangeRates /></QueryClientProvider>
);

beforeEach(() => vi.clearAllMocks());

it('shows live rates, warns about missing ones and saves a manual rate', async () => {
  api.get.mockResolvedValue({ data: {
    base: 'INR', supported: ['INR', 'USD', 'GBP'], missing: ['GBP'], manual: [],
    rates: { INR: { rate: 1, source: 'base' }, USD: { rate: 83.5, source: 'Yahoo Finance' } },
  } });
  api.put.mockResolvedValue({ data: { currency: 'GBP', rate: 105 } });
  renderRates();

  expect(await screen.findByText('₹83.5000')).toBeInTheDocument();
  expect(screen.getByText('Yahoo Finance')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('No rate for GBP');

  await userEvent.selectOptions(screen.getByLabelText('Currency'), 'GBP');
  await userEvent.type(screen.getByLabelText(/manual rate/i), '105');
  await userEvent.click(screen.getByRole('button', { name: 'Save rate' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/fx/rates/GBP', { rate: 105 }));
});
