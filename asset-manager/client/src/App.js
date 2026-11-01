import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Components
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ForgotPassword from './components/Auth/ForgotPassword';
import ResetPassword from './components/Auth/ResetPassword';
import VerifyEmail from './components/Auth/VerifyEmail';
import Layout from './components/Layout/Layout';

const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'));
const Investments = lazy(() => import('./components/Investments/Investments'));
const InvestmentDetail = lazy(() => import('./components/Investments/InvestmentDetail'));
const Portfolio = lazy(() => import('./components/Portfolio/Portfolio'));
const Assets = lazy(() => import('./components/Assets/Assets'));
const Liabilities = lazy(() => import('./components/Liabilities/Liabilities'));
const Budget = lazy(() => import('./components/Budget/Budget'));
const Goals = lazy(() => import('./components/Goals/Goals'));
const Optimizer = lazy(() => import('./components/Optimizer/Optimizer'));
const Quickstart = lazy(() => import('./components/Quickstart/Quickstart'));
const Settings = lazy(() => import('./components/Settings/Settings'));
const Research = lazy(() => import('./components/Research/Research'));

const Spinner = ({ fullScreen }) => (
  <div className={`${fullScreen ? 'min-h-screen' : 'py-24'} flex items-center justify-center`}>
    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600"></div>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <Spinner fullScreen />;
  }
  
  return user ? children : <Navigate to="/login" />;
};

// Public Route Component (redirect to dashboard if authenticated)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <Spinner fullScreen />;
  }
  
  return user ? <Navigate to="/dashboard" /> : children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public Routes */}
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } 
            />
            <Route 
              path="/register" 
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              } 
            />
            
            <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
            <Route path="/verify-email" element={<VerifyEmail />} />

            {/* Protected Routes share one layout; pages load on demand */}
            <Route element={<ProtectedRoute><Layout><Suspense fallback={<Spinner />}><Outlet /></Suspense></Layout></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/investments" element={<Investments />} />
              <Route path="/investments/:id" element={<InvestmentDetail />} />
              <Route path="/assets" element={<Assets />} />
              <Route path="/liabilities" element={<Liabilities />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/budget" element={<Budget />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/optimizer" element={<Optimizer />} />
              <Route path="/quickstart" element={<Quickstart />} />
              <Route path="/research" element={<Research />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
          
          {/* Toast notifications */}
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                style: {
                  background: '#10B981',
                },
              },
              error: {
                style: {
                  background: '#EF4444',
                },
              },
            }}
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App; 