import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/client';
import toast from 'react-hot-toast';

// The refresh token lives in an httpOnly cookie; the access token is kept in memory only

let accessToken = null;
export const getAccessToken = () => accessToken;

const setAccessToken = (token) => {
  accessToken = token;
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
};

const NO_RETRY_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout',
  '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/verify-email'];
const ACCESS_TOKEN_RENEW_MS = 10 * 60 * 1000;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Only one refresh runs at a time; concurrent 401s wait for the same promise.
// A 409 means another tab rotated the cookie a moment ago, so retry with the new cookie.
let refreshPromise = null;
const refreshSession = () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      let lastError;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const { data } = await api.post('/api/auth/refresh');
          setAccessToken(data.accessToken);
          return data;
        } catch (error) {
          lastError = error;
          if (error.response?.status !== 409) break;
          await wait(300);
        }
      }
      setAccessToken(null);
      throw lastError;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const reportErrors = (error, fallback) => {
  const message = error.response?.data?.message || fallback;
  const errors = error.response?.data?.errors;
  if (errors && Array.isArray(errors)) {
    errors.forEach(err => toast.error(err.message || err.msg));
  } else {
    toast.error(message);
  }
  return { success: false, error: message, errors };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const endSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const original = error.config || {};
        const skip = NO_RETRY_PATHS.some(path => (original.url || '').startsWith(path));
        if (error.response?.status === 401 && !original._retry && !skip) {
          original._retry = true;
          try {
            const data = await refreshSession();
            setUser(data.user);
            original.headers.set('Authorization', `Bearer ${data.accessToken}`);
            return api(original);
          } catch (refreshError) {
            endSession();
            toast.error('Session expired. Please login again.');
          }
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(interceptor);
  }, [endSession]);

  // Restore the session from the refresh cookie on page load
  useEffect(() => {
    refreshSession()
      .then(data => setUser(data.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Renew the short-lived access token before it expires
  const signedIn = Boolean(user);
  useEffect(() => {
    if (!signedIn) return undefined;
    const timer = setInterval(() => {
      refreshSession().catch(endSession);
    }, ACCESS_TOKEN_RENEW_MS);
    return () => clearInterval(timer);
  }, [signedIn, endSession]);

  const storeSession = ({ accessToken: token, user: sessionUser }) => {
    setAccessToken(token);
    setUser(sessionUser);
  };

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      if (data.requiresMFA) {
        return { success: true, requiresMFA: true, mfaPendingToken: data.mfaPendingToken, methods: data.methods || [] };
      }
      storeSession(data);
      toast.success('Login successful!');
      return { success: true };
    } catch (error) {
      return reportErrors(error, 'Login failed');
    }
  };

  const completeMfaLogin = async (mfaPendingToken, method, code) => {
    try {
      const { data } = await api.post('/api/auth/login/mfa', { mfaPendingToken, method, code });
      storeSession(data);
      toast.success('Login successful!');
      return { success: true };
    } catch (error) {
      const sessionExpired = error.response?.data?.code === 'MFA_SESSION_INVALID';
      return { ...reportErrors(error, 'Verification failed'), sessionExpired };
    }
  };

  const sendLoginEmailOtp = async (mfaPendingToken) => {
    try {
      await api.post('/api/auth/login/email-otp', { mfaPendingToken });
      toast.success('Verification code sent to your email');
      return { success: true };
    } catch (error) {
      return reportErrors(error, 'Could not send verification code');
    }
  };

  const register = async (userData) => {
    try {
      const { data } = await api.post('/api/auth/register', userData);
      storeSession(data);
      toast.success(data.verificationEmailSent
        ? 'Account created! Check your inbox to confirm your email.'
        : 'Account created successfully!');
      return { success: true };
    } catch (error) {
      return reportErrors(error, 'Registration failed');
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      // The local session is cleared either way
    }
    endSession();
    toast.success('Logged out successfully');
  };

  const logoutOtherDevices = async () => {
    try {
      const { data } = await api.post('/api/auth/logout-all');
      toast.success(data.revoked ? `Signed out ${data.revoked} other session(s)` : 'No other active sessions');
      return { success: true };
    } catch (error) {
      return reportErrors(error, 'Could not sign out other devices');
    }
  };

  const reloadUser = useCallback(async () => {
    try {
      const { data } = await api.get('/api/auth/profile');
      setUser(data.user);
    } catch (error) {
      // Not signed in
    }
  }, []);

  const updateProfile = async (profileData) => {
    try {
      const response = await api.put('/api/auth/profile', profileData);
      setUser(response.data.user);
      toast.success('Profile updated successfully!');
      return { success: true };
    } catch (error) {
      return reportErrors(error, 'Profile update failed');
    }
  };

  const value = {
    user,
    loading,
    login,
    completeMfaLogin,
    sendLoginEmailOtp,
    register,
    logout,
    logoutOtherDevices,
    reloadUser,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
