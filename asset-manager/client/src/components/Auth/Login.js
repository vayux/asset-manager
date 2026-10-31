import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { EyeIcon, EyeSlashIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    mfaToken: '',
    backupCode: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [requiresMFA, setRequiresMFA] = useState(false);
  const [showBackupCode, setShowBackupCode] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
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
    
    // Validate form for initial login or MFA token when required
    if (!requiresMFA && !validateForm()) return;
    
    // If MFA is required, validate MFA input
    if (requiresMFA) {
      if (!formData.mfaToken && !formData.backupCode) {
        setErrors({ general: 'Please enter your authenticator code or backup code' });
        return;
      }
      if (formData.mfaToken && formData.mfaToken.length !== 6) {
        setErrors({ general: 'Authenticator code must be 6 digits' });
        return;
      }
    }
    
    setLoading(true);
    setErrors({});
    
    try {
      const loginData = {
        email: formData.email,
        password: formData.password,
      };

      // Add MFA token if provided
      if (formData.mfaToken) {
        loginData.mfaToken = formData.mfaToken;
      } else if (formData.backupCode) {
        loginData.backupCode = formData.backupCode;
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });

      const data = await response.json();

      if (data.requiresMFA && !requiresMFA) {
        // First time - MFA is required
        setRequiresMFA(true);
        toast('Please enter your 2FA code to continue');
      } else if (data.success && (data.accessToken || data.token)) {
        // Login successful - set tokens and reload to update auth state
        const { accessToken, refreshToken, token, user } = data;
        const authToken = accessToken || token;
        
        if (accessToken && refreshToken) {
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
          localStorage.removeItem('token');
        } else if (token) {
          localStorage.setItem('token', token);
        }
        
        toast.success('Login successful!');
        // Reload the page to let AuthContext pick up the new tokens
        window.location.href = '/dashboard';
      } else {
        // Login failed
        const errorMessage = data.message || 'Login failed';
        setErrors({ general: errorMessage });
        toast.error(errorMessage);
        
        // If MFA verification failed, don't reset the MFA state
        if (!data.message?.includes('Invalid') && !data.message?.includes('code')) {
          setRequiresMFA(false);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ general: 'Login failed. Please try again.' });
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

                {!showBackupCode ? (
                  <div>
                    <label htmlFor="mfaToken" className="form-label">
                      Authenticator Code
                    </label>
                    <input
                      id="mfaToken"
                      name="mfaToken"
                      type="text"
                      value={formData.mfaToken}
                      onChange={(e) => setFormData({
                        ...formData,
                        mfaToken: e.target.value.replace(/\D/g, '').slice(0, 6),
                        backupCode: '' // Clear backup code when entering MFA token
                      })}
                      placeholder="000000"
                      maxLength="6"
                      className="form-input text-center text-lg tracking-widest"
                    />
                    <div className="flex justify-between mt-2">
                      <button
                        type="button"
                        onClick={() => setShowBackupCode(true)}
                        className="text-sm text-primary-600 hover:text-primary-500"
                      >
                        Use backup code instead
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRequiresMFA(false);
                          setFormData({ ...formData, mfaToken: '', backupCode: '' });
                        }}
                        className="text-sm text-gray-600 hover:text-gray-800"
                      >
                        ← Back to login
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="backupCode" className="form-label">
                      Backup Code
                    </label>
                    <input
                      id="backupCode"
                      name="backupCode"
                      type="text"
                      value={formData.backupCode}
                      onChange={(e) => setFormData({
                        ...formData,
                        backupCode: e.target.value.toUpperCase(),
                        mfaToken: '' // Clear MFA token when entering backup code
                      })}
                      placeholder="Enter backup code"
                      className="form-input text-center"
                    />
                    <div className="flex justify-between mt-2">
                      <button
                        type="button"
                        onClick={() => setShowBackupCode(false)}
                        className="text-sm text-primary-600 hover:text-primary-500"
                      >
                        Use authenticator code instead
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRequiresMFA(false);
                          setFormData({ ...formData, mfaToken: '', backupCode: '' });
                        }}
                        className="text-sm text-gray-600 hover:text-gray-800"
                      >
                        ← Back to login
                      </button>
                    </div>
                  </div>
                )}
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