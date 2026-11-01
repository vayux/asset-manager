import React from 'react';
import toast from 'react-hot-toast';
import { QrCodeIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';

const MFASetupStep = ({ qrCode, secret, verificationCode, setVerificationCode, verifyMFASetup, loading, setSetupStep }) => (
  <div className="space-y-6">
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-lg mb-4">
        <QrCodeIcon className="h-6 w-6 text-primary-600" />
      </div>
      <h4 className="text-lg font-medium text-gray-900 mb-2">Scan QR Code</h4>
      <p className="text-sm text-gray-600 mb-6">
        Use Google Authenticator, Authy, or any compatible authenticator app
      </p>
    </div>

    <div className="flex justify-center">
      <div className="p-4 bg-white border border-gray-200 rounded-lg">
        <img src={qrCode} alt="QR Code" className="w-48 h-48" />
      </div>
    </div>

    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900 mb-1">Manual Entry</p>
          <p className="text-sm text-gray-600">Can't scan? Enter this code manually:</p>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(secret);
            toast.success('Secret copied to clipboard!');
          }}
          className="p-2 text-gray-400 hover:text-gray-600"
        >
          <DocumentDuplicateIcon className="h-4 w-4" />
        </button>
      </div>
      <code className="block mt-2 p-2 bg-white border rounded text-sm font-mono break-all">
        {secret}
      </code>
    </div>

    <div>
      <label className="form-label">Enter verification code</label>
      <input
        type="text"
        value={verificationCode}
        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="form-input text-center text-lg tracking-widest"
        placeholder="000000"
        maxLength="6"
      />
      <p className="mt-1 text-xs text-gray-500">
        Enter the 6-digit code from your authenticator app
      </p>
    </div>

    <button
      onClick={verifyMFASetup}
      disabled={loading || verificationCode.length !== 6}
      className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          Verifying...
        </div>
      ) : (
        'Verify & Enable 2FA'
      )}
    </button>
  </div>
);

export default MFASetupStep;
