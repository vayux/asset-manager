# MoneyMind - Intelligent Personal Finance Management

A comprehensive web application for tracking and managing personal investments, built with React and Node.js. MoneyMind digitalizes manual investment tracking and provides intelligent insights for better financial decisions.

## Features

### Current Features
- **User Authentication**: Secure login and registration system
- **Dashboard**: Portfolio overview with visual charts and statistics
- **Investment Tracking**: Categorized investment management
- **Budgeting**: Monthly budgets with overspend detection and alerts
- **Goals**: Dynamic goal tracking with projections and slider UI
- **Wealth Optimizer**: Financial-Health score (with debt-ratio & savings-rate metrics and expandable "How is the score calculated?" panel) plus Tax-Loss Harvest suggestions (investments down ≥10% vs. cost basis) – each metric includes clear "lower is better / higher is better" notes.
- **Responsive Design**: Modern, mobile-friendly interface
- **Real-time Updates**: Live portfolio value calculations

### Planned Features
- **Investment CRUD Operations**: Full create, read, update, delete for investments
- **Portfolio Analytics**: Growth tracking and performance metrics
- **Monthly Snapshots**: Historical portfolio tracking
- **Growth Predictions**: Investment growth forecasting
- **Data Export**: Export portfolio data to various formats
- **Category Management**: Custom investment categories
- **Mobile App**: React Native mobile companion

## Technology Stack

### Backend
- **Node.js** with Express.js
- **PostgreSQL** database with Sequelize ORM
- **JWT** authentication
- **bcrypt** for password hashing
- **Express Validator** for input validation

### Frontend
- **React 18** with functional components and hooks
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Axios** for API communication
- **React Hot Toast** for notifications

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd money-mind
   ```

2. **Install dependencies**
   ```bash
   npm install
   npm run install-all
   ```

3. **Database Setup**
   - Create a PostgreSQL database named `money_mind`
   - Update database credentials in `server/.env` (create from example below)

4. **Environment Configuration**
   Create `server/.env` file:
   ```env
   PORT=5000
   NODE_ENV=development
   
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=money_mind
   DB_USER=your_username
   DB_PASSWORD=your_password
   
   # JWT Secret
   JWT_SECRET=your_very_secure_jwt_secret_key_here
   JWT_EXPIRE=7d
   
   # CORS
   CLIENT_URL=http://localhost:3000
   ```

5. **Run the application**
   ```bash
   npm run dev
   ```

   This will start both the backend server (port 5001) and frontend client (port 3000).

### Development Scripts

- `npm run dev` - Start both client and server in development mode
- `npm run server` - Start only the backend server
- `npm run client` - Start only the frontend client
- `npm run build` - Build the frontend for production

## Database Schema

### Users Table
- `id` (UUID, Primary Key)
- `email` (String, Unique)
- `password` (String, Hashed)
- `firstName` (String)
- `lastName` (String)
- `isActive` (Boolean)

### Investments Table
- `id` (UUID, Primary Key)
- `userId` (UUID, Foreign Key)
- `name` (String)
- `category` (Enum: bank_account, fixed_deposit, etc.)
- `subCategory` (String)
- `currentAmount` (Decimal)
- `initialAmount` (Decimal)
- `interestRate` (Decimal)
- `maturityDate` (Date)
- `accountNumber` (String)
- `institutionName` (String)
- `description` (Text)
- `isActive` (Boolean)

### Portfolio Snapshots Table
- `id` (UUID, Primary Key)
- `userId` (UUID, Foreign Key)
- `snapshotDate` (Date)
- `totalValue` (Decimal)
- `categoryBreakdown` (JSONB)
- `investments` (JSONB)
- `notes` (Text)
- `isManual` (Boolean)

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Investments
- `GET /api/investments` - Get user investments
- `POST /api/investments` - Create new investment
- `GET /api/investments/:id` - Get specific investment
- `PUT /api/investments/:id` - Update investment
- `DELETE /api/investments/:id` - Delete investment
- `GET /api/investments/summary/category` - Get category summary

### Portfolio
- `GET /api/portfolio/overview` - Get portfolio overview
- `POST /api/portfolio/snapshot` - Create portfolio snapshot
- `GET /api/portfolio/snapshots` - Get portfolio snapshots
- `GET /api/portfolio/analytics` - Get portfolio analytics

## Investment Categories

The system supports the following investment categories:
- Bank Account
- Fixed Deposit
- Recurring Deposit
- Stocks
- Mutual Funds
- Provident Fund
- Insurance
- Gold
- Real Estate
- Cryptocurrency
- Personal Loan
- Other

## Usage

1. **Register/Login**: Create an account or login to access the system
2. **Add Investments**: Add your various investments with details
3. **View Dashboard**: Monitor your portfolio overview and statistics
4. **Track Growth**: Create monthly snapshots to track growth over time
5. **Analyze Performance**: Use analytics to understand investment performance

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Create a Pull Request

## Security Features

- Password hashing with bcrypt
- JWT token-based authentication with refresh tokens
- Two-Factor Authentication (2FA) with TOTP support
- Rate limiting protection against brute force attacks
- Password strength validation with complexity requirements
- Input validation and sanitization
- CORS protection
- SQL injection prevention with Sequelize ORM
- XSS protection with helmet.js
- Email notifications for security events and activities
- Backward compatibility maintained for existing users

## Email Notifications

The system supports email notifications for various activities:

### Security Alerts
- Successful logins
- Password changes
- Account security events

### Investment Updates
- New investment additions
- Investment value changes
- Portfolio updates

### Configuration
To enable email notifications, configure the following environment variables in `server/.env`:

```env
# Email configuration (Gmail SMTP example)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
```

Users can control their notification preferences in the Settings page:
- **Email Notifications**: General account notifications
- **Security Alerts**: Security-related activities
- **Investment Updates**: Investment and portfolio changes

## Future Enhancements

- **Mobile Application**: React Native app for mobile access
- **Bank Integration**: Connect with bank APIs for automatic updates
- **Advanced Analytics**: More sophisticated investment analysis
- **Goal Setting**: Set and track investment goals
- **Tax Calculations**: Calculate tax implications
- **Document Storage**: Store investment-related documents
- **Notifications**: Alert system for investment milestones
- **Multi-currency Support**: Support for multiple currencies

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository or contact the development team. 