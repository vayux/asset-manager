import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import AuthCard from './AuthCard';

const VerifyEmail = () => {
  const [params] = useSearchParams();
  const { user, reloadUser } = useAuth();
  const [status, setStatus] = useState('pending');
  const started = useRef(false);

  useEffect(() => {
    // The token is single-use, so make sure a double-mounted effect only sends it once
    if (started.current) return;
    started.current = true;
    api.post('/api/auth/verify-email', { token: params.get('token') || '' })
      .then(() => {
        setStatus('done');
        reloadUser();
      })
      .catch(() => setStatus('failed'));
  }, [params, reloadUser]);

  const message = {
    pending: 'Confirming your email...',
    done: 'Your email is confirmed.',
    failed: 'This link is invalid or has expired. Sign in and request a new one from the banner at the top of the app.',
  }[status];

  return (
    <AuthCard title="Email confirmation">
      <p className="text-sm text-gray-700">{message}</p>
      {status !== 'pending' && (
        <p className="mt-6 text-sm">
          <Link to={user ? '/dashboard' : '/login'} className="text-primary-600 hover:text-primary-500">
            {user ? 'Go to dashboard' : 'Go to sign in'}
          </Link>
        </p>
      )}
    </AuthCard>
  );
};

export default VerifyEmail;
