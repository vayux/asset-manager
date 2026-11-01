import React from 'react';

const AuthCard = ({ title, subtitle, children }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div className="max-w-md w-full space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="mt-2 text-sm text-gray-600">{subtitle}</p>}
      </div>
      <div className="card">{children}</div>
    </div>
  </div>
);

export default AuthCard;
