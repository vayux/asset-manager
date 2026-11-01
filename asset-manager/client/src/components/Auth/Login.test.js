import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import api from '../../api/client';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import Login from './Login';

vi.mock('../../api/client', () => ({ default: {
  defaults: { headers: { common: {} } },
  interceptors: { response: { use: vi.fn(() => 1), eject: vi.fn() } },
  post: vi.fn(),
  get: vi.fn(),
} }));

const noSession = { response: { status: 401, data: { code: 'NO_REFRESH_TOKEN' } } };

const CurrentUser = () => {
  const { user, loading } = useAuth();
  if (loading) return <p>loading</p>;
  return <p>{user ? `signed in as ${user.email}` : 'signed out'}</p>;
};

const renderWithAuth = (ui) => render(
  <AuthProvider>
    <MemoryRouter>{ui}</MemoryRouter>
  </AuthProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  delete api.defaults.headers.common.Authorization;
});

it('restores the session from the refresh cookie and keeps the access token out of localStorage', async () => {
  api.post.mockImplementation((url) => (url === '/api/auth/refresh'
    ? Promise.resolve({ data: { accessToken: 'access-1', user: { email: 'demo@example.com' } } })
    : Promise.reject(new Error(`unexpected ${url}`))));

  renderWithAuth(<CurrentUser />);

  expect(await screen.findByText('signed in as demo@example.com')).toBeInTheDocument();
  expect(api.defaults.headers.common.Authorization).toBe('Bearer access-1');
  expect(window.localStorage.getItem('accessToken')).toBeNull();
});

it('walks through the MFA step without reloading the page', async () => {
  api.post.mockImplementation((url) => {
    if (url === '/api/auth/refresh') return Promise.reject(noSession);
    if (url === '/api/auth/login') return Promise.resolve({ data: { requiresMFA: true, mfaPendingToken: 'pending', methods: ['totp', 'backup'] } });
    if (url === '/api/auth/login/mfa') return Promise.resolve({ data: { accessToken: 'access-2', user: { email: 'mfa@example.com' } } });
    return Promise.reject(new Error(`unexpected ${url}`));
  });

  renderWithAuth(<><Login /><CurrentUser /></>);
  await screen.findByText('signed out');

  await userEvent.type(screen.getByLabelText(/email address/i), 'mfa@example.com');
  await userEvent.type(screen.getByPlaceholderText(/enter your password/i), 'Passw0rd!x');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

  const codeInput = await screen.findByPlaceholderText('000000');
  await userEvent.type(codeInput, '123456');
  await userEvent.click(screen.getByRole('button', { name: /verify|sign in/i }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/auth/login/mfa', { mfaPendingToken: 'pending', method: 'totp', code: '123456' }));
  expect(await screen.findByText('signed in as mfa@example.com')).toBeInTheDocument();
});
