import React from 'react';
import { formatCurrency } from '../../utils/currency';

const StatCard = ({ title, value, Icon, bgClass = 'bg-primary-100', textClass = 'text-primary-600' }) => (
  <div className="stat-card">
    <div className="flex items-center">
      <div className={`p-3 ${bgClass} rounded-lg`}>
        <Icon className={`h-6 w-6 ${textClass}`} />
      </div>
      <div className="ml-4">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{formatCurrency(value)}</p>
      </div>
    </div>
  </div>
);

export default StatCard;
