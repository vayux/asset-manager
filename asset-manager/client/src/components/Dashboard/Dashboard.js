import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import {
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon,
  PlusIcon,
  BanknotesIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { format } from 'date-fns';
import CashFlowForecast from './CashFlowForecast';
import MonthlySummary from './MonthlySummary';
import OverspendAlert from './OverspendAlert';
import { getCategoryDisplayName } from '../../constants/categories';
import { formatCurrency } from '../../utils/currency';

const Dashboard = () => {
  const [portfolioData, setPortfolioData] = useState(null);
  const [assetsTotal, setAssetsTotal] = useState(0);
  const [liabilitiesTotal, setLiabilitiesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recentInvestments, setRecentInvestments] = useState([]);
  const [avgGrowth, setAvgGrowth] = useState(0);
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthFilter]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [portfolioResponse, investmentsResponse, monthlyResponse, assetsResponse, liabilitiesResponse] = await Promise.all([
        api.get(`/api/portfolio/overview?month=${monthFilter}`),
        api.get('/api/investments?limit=5'),
        api.get('/api/portfolio/analytics/monthly?limit=6'),
        api.get('/api/assets'),
        api.get('/api/liabilities')
      ]);

      setPortfolioData(portfolioResponse.data);
      setRecentInvestments(investmentsResponse.data.investments || []);

      // compute avg growth
      const monthlyData = monthlyResponse.data.data || [];
      if (monthlyData.length > 1) {
        let sumGrowth = 0;
        for (let i = 1; i < monthlyData.length; i++) {
          sumGrowth += monthlyData[i].total - monthlyData[i - 1].total;
        }
        setAvgGrowth(sumGrowth / (monthlyData.length - 1));
      } else {
        setAvgGrowth(0);
      }

      // compute totals for assets/liabilities
      const assetsArr = assetsResponse.data.assets || [];
      const liabilitiesArr = liabilitiesResponse.data.liabilities || [];
      const assetsSum = assetsArr.reduce((sum,a)=>sum+parseFloat(a.valueInr ?? a.currentValue ?? 0),0);
      const liabilitiesSum = liabilitiesArr.reduce((sum,l)=>sum+parseFloat(l.outstandingInr ?? l.outstandingAmount ?? 0),0);
      setAssetsTotal(assetsSum);
      setLiabilitiesTotal(liabilitiesSum);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };


  const preparePieChartData = () => {
    if (!portfolioData?.categoryBreakdown) return [];
    
    return Object.entries(portfolioData.categoryBreakdown).map(([category, data]) => ({
      name: getCategoryDisplayName(category),
      value: parseFloat(data.totalAmount),
      count: data.count,
    }));
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-sm text-gray-600">
            Amount: {formatCurrency(payload[0].value)}
          </p>
          <p className="text-sm text-gray-600">
            Investments: {payload[0].payload.count}
          </p>
        </div>
      );
    }
    return null;
  };

  const netWorth = (assetsTotal + (portfolioData?.totalValue||0) - liabilitiesTotal);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Personal Finance Overview</h1>
        <p className="text-primary-100">
          Track and manage your assets, liabilities, and investments in one place
        </p>
      </div>

      <MonthlySummary />
      <OverspendAlert />

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Showing for: {format(new Date(monthFilter + '-01'), 'MMMM yyyy')}</p>
        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="form-input w-40"
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-6">
        {/* Net Worth */}
        <div className="stat-card">
          <div className="flex items-center">
            <div className="p-3 bg-primary-100 rounded-lg">
              <CurrencyDollarIcon className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Net Worth</p>
              <p className="text-xl font-bold text-gray-900 break-words">{formatCurrency(netWorth)}</p>
            </div>
          </div>
        </div>

        {/* Assets */}
        <Link to="/assets" className="stat-card hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-success-100 rounded-lg">
              <BanknotesIcon className="h-6 w-6 text-success-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Assets</p>
              <p className="text-xl font-bold text-gray-900 break-words">{formatCurrency(assetsTotal)}</p>
            </div>
          </div>
        </Link>

        {/* Liabilities */}
        <Link to="/liabilities" className="stat-card hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-danger-100 rounded-lg">
              <CreditCardIcon className="h-6 w-6 text-danger-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Liabilities</p>
              <p className="text-xl font-bold text-gray-900 break-words">{formatCurrency(liabilitiesTotal)}</p>
          </div>
        </div>
        </Link>

        {/* Investments */}
        <div className="stat-card">
          <div className="flex items-center">
            <div className="p-3 bg-success-100 rounded-lg">
              <ChartBarIcon className="h-6 w-6 text-success-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Investments</p>
              <p className="text-xl font-bold text-gray-900 break-words">{formatCurrency(portfolioData?.totalValue||0)}</p>
            </div>
          </div>
        </div>

        {/* Avg Growth */}
        <div className="stat-card">
          <div className="flex items-center">
            <div className="p-3 bg-warning-100 rounded-lg">
              <ArrowTrendingUpIcon className="h-6 w-6 text-warning-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Growth / Month</p>
              <p className="text-xl font-bold text-gray-900 break-words">{formatCurrency(avgGrowth)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio Distribution Chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Portfolio Distribution</h3>
            <Link to="/portfolio" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              View Details
            </Link>
          </div>
          
          {preparePieChartData().length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={preparePieChartData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {preparePieChartData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <ChartBarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No investments to display</p>
                <Link to="/investments" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                  Add your first investment
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Category Breakdown</h3>
            <Link to="/investments" className="btn-primary btn text-sm py-1.5 px-3">
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Investment
            </Link>
          </div>
          
          <div className="space-y-3">
            {Object.entries(portfolioData?.categoryBreakdown || {}).map(([category, data]) => (
              <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{getCategoryDisplayName(category)}</h4>
                  <p className="text-sm text-gray-600">{data.count} investment{data.count !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatCurrency(data.totalAmount)}</p>
                  <p className="text-sm text-gray-600">
                    {portfolioData.totalValue > 0 ? 
                      ((data.totalAmount / portfolioData.totalValue) * 100).toFixed(1) : 0
                    }%
                  </p>
                </div>
              </div>
            ))}
            
            {Object.keys(portfolioData?.categoryBreakdown || {}).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <CurrencyDollarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="mb-2">No investments yet</p>
                <Link to="/investments" className="text-primary-600 hover:text-primary-700 font-medium">
                  Create your first investment
                </Link>
              </div>
            )}
        </div>
      </div>

      {/* Recent Investments */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Investments</h3>
          <Link to="/investments" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            View All
          </Link>
        </div>
        
        {recentInvestments.length > 0 ? (
            <div className="overflow-x-auto max-h-72">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Institution
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentInvestments.map((investment) => (
                  <tr key={investment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{investment.name}</div>
                      {investment.subCategory && (
                        <div className="text-sm text-gray-500">{investment.subCategory}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                        {getCategoryDisplayName(investment.category)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(investment.currentAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {investment.institutionName || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <CurrencyDollarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="mb-2">No investments yet</p>
            <Link to="/investments" className="text-primary-600 hover:text-primary-700 font-medium">
              Add your first investment
            </Link>
          </div>
        )}
        </div>

        {/* Cash Flow Forecast */}
        <CashFlowForecast />
      </div>
    </div>
  );
};

export default Dashboard; 