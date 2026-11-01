import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { EyeIcon, EyeSlashIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '', code: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [mfa, setMfa] = useState(null); // { token, methods }
  const [mfaMethod, setMfaMethod] = useState('totp');

  const { login, completeMfaLogin, sendLoginEmailOtp } = useAuth();
  const navigate = useNavigate();
  const requiresMFA = !!mfa;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const resetMfa = () => {
    setMfa(null);
    setMfaMethod('totp');
    setFormData(prev => ({ ...prev, code: '' }));
  };

  const chooseMethod = async (method) => {
    setMfaMethod(method);
    setFormData(prev => ({ ...prev, code: '' }));
    setErrors({});
    if (method === 'email') {
      await sendLoginEmailOtp(mfa.token);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (requiresMFA) {
      const code = formData.code.trim();
      if (mfaMethod !== 'backup' && !/^\d{6}$/.test(code)) {
        setErrors({ general: 'Enter the 6-digit code' });
        return;
      }
      if (mfaMethod === 'backup' && code.length < 6) {
        setErrors({ general: 'Enter a valid backup code' });
        return;
      }
    } else if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      if (!requiresMFA) {
        const result = await login(formData.email, formData.password);
        if (result.requiresMFA) {
          setMfa({ token: result.mfaPendingToken, methods: result.methods });
          toast('Please enter your 2FA code to continue');
        } else if (result.success) {
          navigate('/dashboard');
        } else {
          setErrors({ general: result.error });
        }
        return;
      }

      const result = await completeMfaLogin(mfa.token, mfaMethod, formData.code.trim());
      if (result.success) {
        navigate('/dashboard');
      } else if (result.sessionExpired) {
        resetMfa();
        setErrors({ general: result.error });
      } else {
        setErrors({ general: result.error });
      }
    } finally {
      setLoading(false);
    }
  };

  const codeLabel = { totp: 'Authenticator Code', backup: 'Backup Code', email: 'Email Code' }[mfaMethod];
  const otherMethods = (mfa?.methods || ['totp', 'backup']).filter(m => m !== mfaMethod);
  const methodLabel = { totp: 'Use authenticator app', backup: 'Use backup code', email: 'Email me a code' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-primary-600 rounded-lg flex items-center justify-center">
            <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your MoneyMind account
          </p>
        </div>

        <div className="card">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {!requiresMFA && (
              <>
                <div>
                  <label htmlFor="email" className="form-label">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className={`form-input ${errors.email ? 'border-red-500 focus:ring-red-500' : ''}`}
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleChange}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="form-label">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      className={`form-input pr-10 ${errors.password ? 'border-red-500 focus:ring-red-500' : ''}`}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>
              </>
            )}

            {requiresMFA && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <ShieldCheckIcon className="h-5 w-5 text-blue-600" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-900">Two-Factor Authentication Required</h4>
                      <p className="text-sm text-blue-700">Enter the code from your authenticator app or use a backup code.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="code" className="form-label">
                    {codeLabel}
                  </label>
                  <input
                    id="code"
                    name="code"
                    type="text"
                    autoComplete="one-time-code"
                    value={formData.code}
                    onChange={(e) => setFormData({
                      ...formData,
                      code: mfaMethod === 'backup'
                        ? e.target.value.toUpperCase().slice(0, 16)
                        : e.target.value.replace(/\D/g, '').slice(0, 6),
                    })}
                    placeholder={mfaMethod === 'backup' ? 'Enter backup code' : '000000'}
                    className="form-input text-center text-lg tracking-widest"
                  />
                  <div className="flex flex-wrap justify-between gap-2 mt-2">
                    {otherMethods.map(method => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => chooseMethod(method)}
                        className="text-sm text-primary-600 hover:text-primary-500"
                      >
                        {methodLabel[method]}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={resetMfa}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      ← Back to login
                    </button>
                  </div>
                </div>
              </div>
            )}

            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">{errors.general}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {requiresMFA ? 'Verifying...' : 'Signing in...'}
                  </div>
                ) : (
                  requiresMFA ? 'Verify & Sign In' : 'Sign in'
                )}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="font-medium text-primary-600 hover:text-primary-500 transition-colors"
                >
                  Sign up here
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login; 