import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import api from '../../api/client';
import { createQueryClient } from '../../api/queryClient';
import Attachments from './Attachments';

vi.mock('../../api/client', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

const renderList = () => render(
  <QueryClientProvider client={createQueryClient({ retry: false })}><Attachments entityType="asset" entityId="a1" /></QueryClientProvider>
);

beforeEach(() => vi.clearAllMocks());

it('lists documents and uploads a picked file as multipart form data', async () => {
  api.get.mockResolvedValue({ data: { attachments: [{ id: 'f1', fileName: 'deed.pdf', sizeBytes: 2048 }] } });
  api.post.mockResolvedValue({ data: {} });
  renderList();

  expect(await screen.findByText('deed.pdf')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/api/attachments?entityType=asset&entityId=a1');

  const file = new File(['%PDF-1.4'], 'invoice.pdf', { type: 'application/pdf' });
  await userEvent.upload(screen.getByTestId('attachment-input'), file);
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  const [url, form] = api.post.mock.calls[0];
  expect(url).toBe('/api/attachments');
  expect(form.get('entityType')).toBe('asset');
  expect(form.get('entityId')).toBe('a1');
  expect(form.get('file').name).toBe('invoice.pdf');
});
