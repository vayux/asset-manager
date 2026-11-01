import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import {
  HomeIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
  RocketLaunchIcon,
  BanknotesIcon,
  CreditCardIcon,
  Squares2X2Icon,
  LightBulbIcon,
  TrophyIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return JSON.parse(localStorage.getItem('sidebarOpen') || 'false');
  });
  const [collapsed, setCollapsed] = useState(() => JSON.parse(localStorage.getItem('sidebarCollapsed') || 'false'));
  const { user, logout } = useAuth();
  const resendVerification = async () => {
    try {
      const { data } = await axios.post('/api/auth/resend-verification');
      toast.success(data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not send verification email');
    }
  };
  const location = useLocation();

  const handleSidebarToggle = (open) => {
    setSidebarOpen(open);
    localStorage.setItem('sidebarOpen', JSON.stringify(open));
  };

  const toggleCollapse = () => {
    const newVal = !collapsed;
    setCollapsed(newVal);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newVal));
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, current: location.pathname === '/dashboard', primary: true },
    { name: 'Investments', href: '/investments', icon: CurrencyDollarIcon, current: location.pathname === '/investments', primary: true },
    { name: 'Assets', href: '/assets', icon: BanknotesIcon, current: location.pathname === '/assets', primary: true },
    { name: 'Liabilities', href: '/liabilities', icon: CreditCardIcon, current: location.pathname === '/liabilities', primary: true },
    { name: 'Budget', href: '/budget', icon: ChartBarIcon, current: location.pathname === '/budget', primary: true },
    { name: 'Portfolio', href: '/portfolio', icon: Squares2X2Icon, current: location.pathname === '/portfolio', primary: false },
    { name: 'Goals', href: '/goals', icon: TrophyIcon, current: location.pathname === '/goals', primary: false },
    { name: 'Optimizer', href: '/optimizer', icon: LightBulbIcon, current: location.pathname === '/optimizer', primary: false },
    { name: 'Quickstart', href: '/quickstart', icon: RocketLaunchIcon, current: location.pathname === '/quickstart', primary: false },
    { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, current: location.pathname === '/settings', primary: false },
  ];

  const displayedNav = navigation;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => handleSidebarToggle(false)} />
        </div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 ${collapsed?'w-20':'w-64'} bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xl font-bold">₹</span>
            </div>
            {!collapsed && <span className="ml-3 text-xl font-semibold text-gray-900">MoneyMind</span>}
          </div>
          <button
            onClick={() => handleSidebarToggle(false)}
            className="lg:hidden p-1 rounded-md hover:bg-gray-100"
          >
            <XMarkIcon className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        <nav className="mt-6 px-3">
          {displayedNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg mb-1 transition-colors ${
                  item.current
                    ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
                onClick={() => handleSidebarToggle(false)}
              >
                <Icon
                  className={`mr-3 h-5 w-5 ${
                    item.current ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'
                  }`}
                />
                {!collapsed && item.name}
              </Link>
            );
          })}
        </nav>

        {/* User profile section */}
        <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-gray-200 flex flex-col items-center">
          <div className="flex items-center justify-center">
            <UserCircleIcon className="h-8 w-8 text-gray-400" />
            {!collapsed && (
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
              </div>) }
          </div>
          {!collapsed && (
            <button onClick={logout} className="mt-2 w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors">Sign out</button>
          )}
          <button onClick={toggleCollapse} className="mt-2 p-1 rounded hover:bg-gray-100">
            {collapsed? <ChevronDoubleRightIcon className="h-5 w-5 text-gray-500"/> : <ChevronDoubleLeftIcon className="h-5 w-5 text-gray-500"/>}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:ml-0">
        {/* Top header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => handleSidebarToggle(true)}
              className="lg:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            
            <div className="flex-1 lg:flex lg:items-center lg:justify-between">
              <div className="lg:flex-1">
                <h1 className="text-2xl font-semibold text-gray-900">
                  {navigation.find(item => item.current)?.name || 'Dashboard'}
                </h1>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="hidden sm:block text-sm text-gray-500">
                  Welcome back, {user?.firstName}!
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto">
          <div className="py-6 px-4 sm:px-6 lg:px-8">
            {user && !user.emailVerifiedAt && (
              <div className="mb-4 rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800 flex items-center justify-between">
                <span>Please confirm your email address ({user.email}).</span>
                <button type="button" onClick={resendVerification} className="font-medium underline">Resend email</button>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout; 