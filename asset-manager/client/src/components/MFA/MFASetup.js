import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  ShieldCheckIcon, 
  QrCodeIcon, 
  KeyIcon, 
  DocumentDuplicateIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';
import { getAccessToken } from '../../contexts/AuthContext';

const MFASetup = () => {
  const [mfaStatus, setMfaStatus] = useState(null);
  const [setupStep, setSetupStep] = useState('check'); // check, setup, verify, complete
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  // Check current MFA status
  useEffect(() => {
    checkMFAStatus();
  }, []);

  const checkMFAStatus = async () => {
    try {
      const accessToken = getAccessToken();
      const response = await fetch('/api/mfa/status', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      
      if (data.success) {
        setMfaStatus(data.data);
        setSetupStep(data.data.mfaEnabled ? 'complete' : 'check');
      }
    } catch (error) {
      console.error('Failed to check MFA status:', error);
      toast.error('Failed to check MFA status');
    }
  };

  const startMFASetup = async () => {
    setLoading(true);
    try {
      const accessToken = getAccessToken();
      const response = await fetch('/api/mfa/setup/totp', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      
      if (data.success) {
        setQrCode(data.data.qrCode);
        setSecret(data.data.secret);
        setSetupStep('setup');
        toast.success('MFA setup started. Scan the QR code with your authenticator app.');
      } else {
        toast.error(data.message || 'Failed to setup MFA');
      }
    } catch (error) {
      console.error('MFA setup error:', error);
      toast.error('Failed to setup MFA');
    } finally {
      setLoading(false);
    }
  };

  const verifyMFASetup = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const accessToken = getAccessToken();
      const response = await fetch('/api/mfa/setup/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: verificationCode })
      });
      const data = await response.json();
      
      if (data.success) {
        setBackupCodes(data.data.backupCodes);
        setSetupStep('complete');
        setMfaStatus({ ...mfaStatus, mfaEnabled: true });
        setShowBackupCodes(true);
        toast.success('2FA enabled successfully!');
      } else {
        toast.error(data.message || 'Invalid verification code');
      }
    } catch (error) {
      console.error('MFA verification error:', error);
      toast.error('Failed to verify MFA');
    } finally {
      setLoading(false);
    }
  };

  const disableMFA = async () => {
    const password = prompt('Enter your password to disable 2FA:');
    const token = prompt('Enter your authenticator code or backup code:');
    
    if (!password || !token) return;

    setLoading(true);
    try {
      const accessToken = getAccessToken();
      const response = await fetch('/api/mfa/disable', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password, token })
      });
      const data = await response.json();
      
      if (data.success) {
        setMfaStatus({ ...mfaStatus, mfaEnabled: false });
        setSetupStep('check');
        setBackupCodes([]);
        toast.success('2FA disabled successfully');
      } else {
        toast.error(data.message || 'Failed to disable 2FA');
      }
    } catch (error) {
      console.error('MFA disable error:', error);
      toast.error('Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const regenerateBackupCodes = async () => {
    const password = prompt('Enter your password to regenerate backup codes:');
    if (!password) return;

    setLoading(true);
    try {
      const accessToken = getAccessToken();
      const response = await fetch('/api/mfa/backup-codes/regenerate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      
      if (data.success) {
        setBackupCodes(data.data.backupCodes);
        setShowBackupCodes(true);
        toast.success('New backup codes generated!');
      } else {
        toast.error(data.message || 'Failed to regenerate codes');
      }
    } catch (error) {
      console.error('Backup codes error:', error);
      toast.error('Failed to regenerate backup codes');
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    const text = backupCodes.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Backup codes copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy backup codes');
    });
  };

  if (!mfaStatus) {
    return (
      <div className="card">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-primary-100 rounded-lg">
            <ShieldCheckIcon className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h3>
            <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
          </div>
        </div>
        
        {setupStep === 'check' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900">Why enable 2FA?</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Two-factor authentication significantly increases your account security by requiring 
                    a second form of verification beyond just your password.
                  </p>
                </div>
              </div>
            </div>
            
            <button
              onClick={startMFASetup}
              disabled={loading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Setting up...
                </div>
              ) : (
                <div className="flex items-center">
                  <ShieldCheckIcon className="h-4 w-4 mr-2" />
                  Enable 2FA
                </div>
              )}
            </button>
          </div>
        )}

        {setupStep === 'setup' && (
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
        )}

        {setupStep === 'complete' && mfaStatus.mfaEnabled && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <ShieldCheckIcon className="h-5 w-5 text-green-600" />
                <div>
                  <h4 className="text-sm font-medium text-green-900">2FA Enabled</h4>
                  <p className="text-sm text-green-700">Your account is now protected with two-factor authentication</p>
                </div>
              </div>
            </div>

            {showBackupCodes && backupCodes.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3 mb-4">
                  <KeyIcon className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-900">Save Your Backup Codes</h4>
                    <p className="text-sm text-yellow-700">
                      Store these codes in a safe place. You can use them to access your account if you lose your phone.
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {backupCodes.map((code, index) => (
                    <code key={index} className="block p-2 bg-white border rounded text-center text-sm font-mono">
                      {code}
                    </code>
                  ))}
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={copyBackupCodes}
                    className="btn-secondary text-sm"
                  >
                    <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
                    Copy Codes
                  </button>
                  <button
                    onClick={() => setShowBackupCodes(false)}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    I've saved them
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">Backup codes remaining</p>
                  <p className="text-sm text-gray-600">{mfaStatus.backupCodesRemaining} codes available</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={regenerateBackupCodes}
                  disabled={loading}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generate New Codes
                </button>
                
                <button
                  onClick={disableMFA}
                  disabled={loading}
                  className="btn-danger disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Disable 2FA
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MFASetup; 