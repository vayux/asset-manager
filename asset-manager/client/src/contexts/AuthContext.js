import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Token refresh function
  const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post('/api/auth/refresh', {
        refreshToken
      });

      const { accessToken, refreshToken: newRefreshToken } = response.data;
      
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', newRefreshToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      
      return accessToken;
    } catch (error) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      throw error;
    }
  };

  // Set up axios interceptor for token
  useEffect(() => {
    // Support both old and new token storage formats
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    }

    // Add response interceptor to handle token expiration
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          // Check if it's a token expiration error
          if (error.response?.data?.code === 'TOKEN_EXPIRED' && !isRefreshing) {
            setIsRefreshing(true);
            
            try {
              const newToken = await refreshAccessToken();
              originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
              setIsRefreshing(false);
              return axios(originalRequest);
            } catch (refreshError) {
              setIsRefreshing(false);
              setUser(null);
              toast.error('Session expired. Please login again.');
              return Promise.reject(refreshError);
            }
          }
        }

        // Handle other auth errors
        if (error.response?.status === 401) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          delete axios.defaults.headers.common['Authorization'];
          setUser(null);
          
          const errorCode = error.response?.data?.code;
          if (errorCode === 'TOKEN_EXPIRED') {
            toast.error('Session expired. Please login again.');
          } else if (errorCode === 'INVALID_TOKEN') {
            toast.error('Invalid session. Please login again.');
          } else {
            toast.error('Authentication failed. Please login again.');
          }
        }
        
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [isRefreshing]);

  // Check if user is authenticated on app start
  useEffect(() => {
    const initializeAuth = async () => {
      // Support both old and new token storage formats
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        try {
          const response = await axios.get('/api/auth/profile');
          setUser(response.data.user);
        } catch (error) {
          // Try to refresh token if access token is expired
          if (error.response?.data?.code === 'TOKEN_EXPIRED') {
            try {
              await refreshAccessToken();
              const response = await axios.get('/api/auth/profile');
              setUser(response.data.user);
            } catch (refreshError) {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              delete axios.defaults.headers.common['Authorization'];
            }
          } else {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            delete axios.defaults.headers.common['Authorization'];
          }
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const storeSession = ({ accessToken, refreshToken, user: sessionUser }) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.removeItem('token');
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    setUser(sessionUser);
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

  const login = async (email, password) => {
    try {
      const { data } = await axios.post('/api/auth/login', { email, password });
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
      const { data } = await axios.post('/api/auth/login/mfa', { mfaPendingToken, method, code });
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
      await axios.post('/api/auth/login/email-otp', { mfaPendingToken });
      toast.success('Verification code sent to your email');
      return { success: true };
    } catch (error) {
      return reportErrors(error, 'Could not send verification code');
    }
  };

  const register = async (userData) => {
    try {
      const { data } = await axios.post('/api/auth/register', userData);
      storeSession(data);
      toast.success('Account created successfully!');
      return { success: true };
    } catch (error) {
      return reportErrors(error, 'Registration failed');
    }
  };

  const logout = () => {
    // Clean up both old and new token formats
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    toast.success('Logged out successfully');
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await axios.put('/api/auth/profile', profileData);
      setUser(response.data.user);
      toast.success('Profile updated successfully!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Profile update failed';
      toast.error(message);
      return { success: false, error: message };
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
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 