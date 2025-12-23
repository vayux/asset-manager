import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

const MFARegistrationPrompt = ({ onClose, onSetupLater }) => {
  const navigate = useNavigate();

  const handleSetupNow = () => {
    navigate('/settings');
  };

  const handleSetupLater = () => {
    onSetupLater();
    navigate('/dashboard');
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <ShieldCheckIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Account Created Successfully!
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          
          <div className="mt-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                Secure Your Account with 2FA
              </h4>
              <p className="text-sm text-blue-700">
                Enable two-factor authentication to add an extra layer of security to your account. 
                This helps protect your financial data even if your password is compromised.
              </p>
            </div>
            
            <div className="flex flex-col space-y-3">
              <button
                onClick={handleSetupNow}
                className="w-full btn-primary"
              >
                Set Up 2FA Now
              </button>
              
              <button
                onClick={handleSetupLater}
                className="w-full btn-secondary"
              >
                Set Up Later
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mt-3 text-center">
              You can always enable 2FA later from your account settings
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MFARegistrationPrompt; 