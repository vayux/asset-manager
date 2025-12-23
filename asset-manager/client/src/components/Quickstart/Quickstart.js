import React from 'react';
import { Link } from 'react-router-dom';
import {
  CurrencyDollarIcon,
  BanknotesIcon,
  ChartBarIcon,
  TrophyIcon,
  RocketLaunchIcon,
  ArrowTrendingUpIcon,
  ShieldCheckIcon,
  KeyIcon,
  BellIcon,
  UserIcon,
  EnvelopeIcon,
  LockClosedIcon,
  DevicePhoneMobileIcon,
  CogIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

const Section = ({title, icon: Icon, children, priority = 'normal'})=> {
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

const FeatureCard = ({icon: Icon, title, description, status = 'available'}) => {
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

const Quickstart = () => {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center mb-4">
          <RocketLaunchIcon className="h-12 w-12 mr-4"/>
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome to MoneyMind!</h1>
            <p className="text-primary-100 text-lg">Your intelligent personal finance management solution with enterprise-grade security.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center">
              <ShieldCheckIcon className="h-6 w-6 mr-2"/>
              <span className="font-medium">Bank-Level Security</span>
            </div>
            <p className="text-sm text-primary-100 mt-1">2FA, encrypted data, security alerts</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center">
              <BellIcon className="h-6 w-6 mr-2"/>
              <span className="font-medium">Smart Notifications</span>
            </div>
            <p className="text-sm text-primary-100 mt-1">Email alerts for all activities</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center">
              <ChartBarIcon className="h-6 w-6 mr-2"/>
              <span className="font-medium">Complete Tracking</span>
            </div>
            <p className="text-sm text-primary-100 mt-1">Investments, assets, goals, budgets</p>
          </div>
        </div>
      </div>

      {/* Security First - Critical Setup */}
      <Section title="🔒 Step 1: Secure Your Account (Critical)" icon={ShieldCheckIcon} priority="high">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center mb-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2"/>
            <span className="font-medium text-red-800">Security Setup Required</span>
          </div>
          <p className="text-red-700 text-sm">Complete these security steps immediately to protect your financial data.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FeatureCard 
            icon={DevicePhoneMobileIcon}
            title="Enable Two-Factor Authentication"
            description="Add an extra layer of security with Google Authenticator or similar TOTP apps"
            status="important"
          />
          <FeatureCard 
            icon={KeyIcon}
            title="Strong Password"
            description="Use 8+ characters with uppercase, lowercase, numbers, and special characters"
            status="important"
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
          <h4 className="font-medium text-blue-900 mb-2">🛡️ How to Enable 2FA:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>Go to <Link to="/settings" className="underline font-medium">Settings → Security</Link></li>
            <li>Click "Set up Two-Factor Authentication"</li>
            <li>Scan the QR code with Google Authenticator</li>
            <li>Enter the 6-digit code to verify</li>
            <li>Save your backup codes in a secure location</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className="bg-green-50 border border-green-200 rounded p-3">
            <div className="flex items-center text-green-800">
              <CheckCircleIcon className="h-4 w-4 mr-1"/>
              <span className="text-xs font-medium">Password Strength Validation</span>
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded p-3">
            <div className="flex items-center text-green-800">
              <CheckCircleIcon className="h-4 w-4 mr-1"/>
              <span className="text-xs font-medium">Rate Limiting Protection</span>
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded p-3">
            <div className="flex items-center text-green-800">
              <CheckCircleIcon className="h-4 w-4 mr-1"/>
              <span className="text-xs font-medium">Security Event Logging</span>
            </div>
          </div>
        </div>
      </Section>

      {/* Email Notifications Setup */}
      <Section title="📧 Step 2: Configure Notifications" icon={BellIcon} priority="medium">
        <p>Stay informed about all account activities with intelligent email notifications.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard 
            icon={LockClosedIcon}
            title="Security Alerts"
            description="Login notifications, password changes, suspicious activities"
            status="new"
          />
          <FeatureCard 
            icon={ChartBarIcon}
            title="Investment Updates"
            description="New investments, value changes, portfolio milestones"
            status="new"
          />
          <FeatureCard 
            icon={EnvelopeIcon}
            title="General Notifications"
            description="Account updates, feature announcements, tips"
            status="new"
          />
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
          <h4 className="font-medium text-amber-900 mb-2">⚙️ Customize Your Notifications:</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-amber-800">
            <li>Visit <Link to="/settings" className="underline font-medium">Settings → Notifications</Link></li>
            <li>Toggle notification types on/off with simple switches</li>
            <li>Changes are saved automatically</li>
            <li>You can change preferences anytime</li>
          </ul>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
          <h5 className="font-medium text-gray-900 mb-2">📱 Sample Security Alert Email:</h5>
          <div className="bg-white border rounded p-3 text-xs">
                         <div className="text-red-600 font-medium">🔒 Security Alert - MoneyMind</div>
            <p className="mt-1 text-gray-600">Hello Pulkit,</p>
            <p className="text-gray-600">We detected a successful login to your account:</p>
            <div className="bg-gray-50 p-2 mt-2 rounded text-gray-700">
              <strong>Activity:</strong> Successful Login<br/>
              <strong>Time:</strong> Dec 15, 2024 at 10:30 AM<br/>
              <strong>IP Address:</strong> 192.168.1.100
            </div>
          </div>
        </div>
      </Section>

      {/* Account Management */}
      <Section title="👤 Step 3: Complete Your Profile" icon={UserIcon}>
        <p>Set up your profile and account preferences for a personalized experience.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FeatureCard 
            icon={UserIcon}
            title="Profile Information"
            description="Update your name, email, and personal details"
            status="available"
          />
          <FeatureCard 
            icon={CogIcon}
            title="Account Settings"
            description="Manage security settings, change password, view activity"
            status="available"
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
          <h4 className="font-medium text-blue-900 mb-2">🔧 Available Settings:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800">
            <div>• Change password with strength validation</div>
            <div>• Update profile information</div>
            <div>• Configure notification preferences</div>
            <div>• Manage 2FA settings</div>
            <div>• View security activity logs</div>
            <div>• Export account data</div>
          </div>
        </div>
      </Section>

      {/* Investment Tracking */}
      <Section title="💰 Step 4: Add Your Investments" icon={ChartBarIcon}>
        <p>Start tracking your investment portfolio with comprehensive categorization and analysis.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">📊 Investment Categories:</h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              <div>• Bank Accounts</div>
              <div>• Fixed Deposits</div>
              <div>• Stocks & Equity</div>
              <div>• Mutual Funds</div>
              <div>• Cryptocurrency</div>
              <div>• Gold & Commodities</div>
              <div>• Real Estate</div>
              <div>• Insurance</div>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">📈 Smart Features:</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <div>• Automatic value tracking</div>
              <div>• Historical performance</div>
              <div>• Category-wise analysis</div>
              <div>• Growth projections</div>
              <div>• Email notifications for changes</div>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
          <h4 className="font-medium text-green-900 mb-2">💡 Quick Start Example:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-green-800">
            <li>Go to <Link to="/investments" className="underline font-medium">Investments</Link> → Click "Add Investment"</li>
            <li>Select category: "Stocks" → Name: "Reliance Industries"</li>
            <li>Current Amount: ₹1,50,000 → Initial Amount: ₹1,20,000</li>
            <li>Investment Date: Select purchase date</li>
            <li>Click "Save" → Watch your dashboard update instantly!</li>
          </ol>
          <p className="text-green-700 mt-2 text-sm">✅ You'll receive an email notification confirming the investment was added.</p>
        </div>
      </Section>

      {/* Comprehensive Financial Management */}
      <Section title="🏠 Step 5: Track Assets & Liabilities" icon={BanknotesIcon}>
        <p>Get a complete picture of your net worth by tracking what you own and owe.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FeatureCard 
            icon={BanknotesIcon}
            title="Assets Management"
            description="Track real estate, vehicles, gold, and other valuable possessions"
            status="available"
          />
          <FeatureCard 
            icon={CurrencyDollarIcon}
            title="Liability Tracking"
            description="Monitor loans, credit cards, and other debts with interest calculations"
            status="available"
          />
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
          <h4 className="font-medium text-gray-900 mb-2">📋 Example Net Worth Calculation:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h5 className="font-medium text-green-700 mb-1">Assets (+)</h5>
              <div className="space-y-1 text-gray-600">
                <div>House: ₹50,00,000</div>
                <div>Car: ₹8,00,000</div>
                <div>Gold: ₹2,00,000</div>
                <div className="font-medium">Total: ₹60,00,000</div>
              </div>
            </div>
            <div>
              <h5 className="font-medium text-red-700 mb-1">Liabilities (-)</h5>
              <div className="space-y-1 text-gray-600">
                <div>Home Loan: ₹25,00,000</div>
                <div>Car Loan: ₹3,00,000</div>
                <div>Credit Card: ₹50,000</div>
                <div className="font-medium">Total: ₹28,50,000</div>
              </div>
            </div>
          </div>
          <div className="mt-3 p-2 bg-blue-100 rounded text-blue-800 font-medium">
            Net Worth = ₹60,00,000 - ₹28,50,000 = ₹31,50,000
          </div>
        </div>
      </Section>

      {/* Budget Management */}
      <Section title="📊 Step 6: Create Your Budget" icon={CurrencyDollarIcon}>
        <p>Take control of your spending with intelligent budget tracking and overspend alerts.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard 
            icon={CurrencyDollarIcon}
            title="50-30-20 Framework"
            description="Needs (50%), Wants (30%), Savings (20%) budget allocation"
            status="available"
          />
          <FeatureCard 
            icon={ExclamationTriangleIcon}
            title="Overspend Alerts"
            description="Automatic warnings when you exceed category limits"
            status="new"
          />
          <FeatureCard 
            icon={ChartBarIcon}
            title="Visual Progress"
            description="Color-coded progress bars and spending analytics"
            status="available"
          />
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-4">
          <h4 className="font-medium text-purple-900 mb-2">🎯 Smart Budget Features:</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-purple-800">
            <li><strong>Real-time tracking:</strong> See spending progress as you log expenses</li>
            <li><strong>Category insights:</strong> Understand where your money goes</li>
            <li><strong>Overspend protection:</strong> Get alerts before you exceed limits</li>
            <li><strong>Monthly rollover:</strong> Unused budget carries forward (optional)</li>
            <li><strong>Goal integration:</strong> Budget affects goal completion timelines</li>
          </ul>
        </div>
      </Section>

      {/* Goals and Planning */}
      <Section title="🎯 Step 7: Set Financial Goals" icon={TrophyIcon}>
        <p>Define and track your financial objectives with intelligent projections and Monte Carlo simulations.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FeatureCard 
            icon={TrophyIcon}
            title="Investment Goals"
            description="Track portfolio-specific targets and growth milestones"
            status="available"
          />
          <FeatureCard 
            icon={ArrowTrendingUpIcon}
            title="Net Worth Goals"
            description="Comprehensive goals including assets minus liabilities"
            status="available"
          />
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mt-4">
          <h4 className="font-medium text-indigo-900 mb-2">🚀 Goal Examples:</h4>
          <div className="space-y-2 text-sm text-indigo-800">
            <div><strong>Emergency Fund:</strong> ₹6,00,000 by Dec 2025 (6 months expenses)</div>
            <div><strong>House Down Payment:</strong> ₹20,00,000 by Mar 2026</div>
            <div><strong>Retirement Corpus:</strong> ₹2,00,00,000 by age 60</div>
            <div><strong>Child Education:</strong> ₹50,00,000 by 2030</div>
          </div>
          <p className="text-indigo-700 mt-2 text-sm">💡 Use the interactive slider to see how increasing monthly contributions affects your timeline!</p>
        </div>
      </Section>

      {/* Portfolio Analytics */}
      <Section title="📈 Step 8: Analyze Performance" icon={ArrowTrendingUpIcon}>
        <p>Gain deep insights into your investment performance with advanced analytics and visualizations.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FeatureCard 
            icon={ChartBarIcon}
            title="Portfolio Analytics"
            description="Month-by-month performance tracking with interactive charts"
            status="available"
          />
          <FeatureCard 
            icon={RocketLaunchIcon}
            title="Wealth Optimizer"
            description="Financial health score and tax-loss harvesting suggestions"
            status="available"
          />
        </div>

        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mt-4">
          <h4 className="font-medium text-teal-900 mb-2">📊 Advanced Analytics:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-teal-800">
            <div>
              <strong>Performance Metrics:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Monthly returns analysis</li>
                <li>Category-wise breakdown</li>
                <li>Growth trend visualization</li>
                <li>Historical snapshots</li>
              </ul>
            </div>
            <div>
              <strong>Optimization Tools:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Financial health scoring</li>
                <li>Tax-loss harvesting</li>
                <li>Debt-to-income analysis</li>
                <li>Savings rate tracking</li>
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* Success Message */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center mb-4">
          <CheckCircleIcon className="h-8 w-8 mr-3"/>
          <h2 className="text-2xl font-bold">You're All Set! 🎉</h2>
        </div>
                 <p className="text-green-100 text-lg mb-4">
           Your MoneyMind account is now fully configured with enterprise-grade security and comprehensive tracking.
         </p>
        <div className="flex flex-wrap gap-3">
          <Link 
            to="/dashboard" 
            className="bg-white text-green-600 px-6 py-2 rounded-lg font-medium hover:bg-green-50 transition-colors"
          >
            View Dashboard →
          </Link>
          <Link 
            to="/settings" 
            className="bg-green-700 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-800 transition-colors"
          >
            Security Settings
          </Link>
          <Link 
            to="/investments" 
            className="bg-green-700 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-800 transition-colors"
          >
            Add Investments
          </Link>
        </div>
      </div>

      {/* Security Reminder */}
      <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
        <div className="flex">
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 mr-2 mt-0.5"/>
          <div>
            <h3 className="text-sm font-medium text-amber-800">Security Reminder</h3>
            <p className="text-sm text-amber-700 mt-1">
                             Remember to enable 2FA and configure email notifications for the best security experience. 
               Your financial data in MoneyMind deserves the highest level of protection.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Quickstart; 