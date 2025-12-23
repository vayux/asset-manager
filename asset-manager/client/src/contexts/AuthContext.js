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
    const accessToken = localStorage.getItem('accessToken') || localStorage.getItem('token');
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
      const accessToken = localStorage.getItem('accessToken') || localStorage.getItem('token');
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

  const login = async (email, password) => {
    try {
      const response = await axios.post('/api/auth/login', {
        email,
        password,
      });

      // Support both old and new response formats
      const { accessToken, refreshToken, token, user } = response.data;
      const authToken = accessToken || token;
      
      if (accessToken && refreshToken) {
        // New format with refresh tokens
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        // Clean up old token if it exists
        localStorage.removeItem('token');
      } else if (token) {
        // Old format - keep for backward compatibility
        localStorage.setItem('token', token);
      }
      
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      setUser(user);
      
      toast.success('Login successful!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      const errors = error.response?.data?.errors;
      
      if (errors && Array.isArray(errors)) {
        errors.forEach(err => toast.error(err.message));
      } else {
        toast.error(message);
      }
      
      return { success: false, error: message, errors };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post('/api/auth/register', userData);

      // Support both old and new response formats
      const { accessToken, refreshToken, token, user } = response.data;
      const authToken = accessToken || token;
      
      if (accessToken && refreshToken) {
        // New format with refresh tokens
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        // Clean up old token if it exists
        localStorage.removeItem('token');
      } else if (token) {
        // Old format - keep for backward compatibility
        localStorage.setItem('token', token);
      }
      
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      setUser(user);
      
      toast.success('Account created successfully!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      const errors = error.response?.data?.errors;
      
      if (errors && Array.isArray(errors)) {
        errors.forEach(err => toast.error(err.message));
      } else {
        toast.error(message);
      }
      
      return { success: false, error: message, errors };
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