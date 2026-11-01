import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import toast from 'react-hot-toast';
import AuthCard from './AuthCard';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSent(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a link to choose a new password.">
      {sent ? (
        <p className="text-sm text-gray-700">
          If an account exists for <strong>{email}</strong>, a reset link is on its way. The link expires in 30 minutes.
        </p>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="form-label">Email address</label>
            <input id="email" type="email" required autoComplete="email" className="form-input"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" disabled={loading} className="w-full btn-primary disabled:opacity-50">
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="text-primary-600 hover:text-primary-500">Back to sign in</Link>
      </p>
    </AuthCard>
  );
};

export default ForgotPassword;
