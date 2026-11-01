import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import toast from 'react-hot-toast';
import AuthCard from './AuthCard';

const ResetPassword = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token, password });
      toast.success('Password updated. Please sign in.');
      navigate('/login');
    } catch (error) {
      const errors = error.response?.data?.errors;
      if (Array.isArray(errors)) errors.forEach(err => toast.error(err.message));
      else toast.error(error.response?.data?.message || 'Could not reset password');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthCard title="Reset your password">
        <p className="text-sm text-gray-700">This reset link is incomplete.</p>
        <p className="mt-4 text-sm"><Link to="/forgot-password" className="text-primary-600">Request a new link</Link></p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle="At least 8 characters with upper and lower case, a number and a symbol.">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="password" className="form-label">New password</label>
          <input id="password" type="password" required autoComplete="new-password" className="form-input"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label htmlFor="confirm" className="form-label">Confirm new password</label>
          <input id="confirm" type="password" required autoComplete="new-password" className="form-input"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <button type="submit" disabled={loading} className="w-full btn-primary disabled:opacity-50">
          {loading ? 'Saving...' : 'Update password'}
        </button>
      </form>
    </AuthCard>
  );
};

export default ResetPassword;
