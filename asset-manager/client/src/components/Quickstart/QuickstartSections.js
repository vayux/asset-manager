import React from 'react';

export const Section = ({title, icon: Icon, children, priority = 'normal'})=> {
  const priorityStyles = {
    high: 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200',
    medium: 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200',
    normal: 'bg-white border-gray-200'
  };

  return (
    <div className={`p-6 rounded-lg shadow-sm border space-y-3 ${priorityStyles[priority]}`}>
      <div className="flex items-center mb-3">
        <Icon className={`h-6 w-6 mr-3 ${priority === 'high' ? 'text-red-600' : priority === 'medium' ? 'text-yellow-600' : 'text-primary-600'}`}/>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {priority === 'high' && <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">Critical</span>}
        {priority === 'medium' && <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full">Important</span>}
      </div>
      <div className="text-sm text-gray-700 space-y-3">
        {children}
      </div>
    </div>
  );
};

export const FeatureCard = ({icon: Icon, title, description, status = 'available'}) => {
  const statusStyles = {
    available: 'border-green-200 bg-green-50',
    new: 'border-blue-200 bg-blue-50',
    important: 'border-yellow-200 bg-yellow-50'
  };

  return (
    <div className={`p-4 rounded-lg border ${statusStyles[status]}`}>
      <div className="flex items-center mb-2">
        <Icon className="h-5 w-5 mr-2 text-gray-600"/>
        <h4 className="font-medium text-gray-900">{title}</h4>
        {status === 'new' && <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">New!</span>}
      </div>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
};
