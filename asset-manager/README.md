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
- Node.js 20
- PostgreSQL 15 (or Docker)

### Option A: Docker Compose

```bash
cp server/.env.example server/.env   # then set JWT_SECRET and JWT_REFRESH_SECRET
docker compose up
```

This starts Postgres, the API on http://localhost:5001 and the React app on http://localhost:3000.

### Option B: run locally

1. Install dependencies: `npm run install-all`
2. Create a Postgres database named `asset_manager`.
3. `cp server/.env.example server/.env` and fill it in. `JWT_SECRET` and `JWT_REFRESH_SECRET` must be two different random
   values of at least 32 characters (`openssl rand -hex 32`); the server will not start otherwise.
4. `npm run dev` starts the API (port 5001) and the client (port 3000). The client proxies `/api` to the API.

### Database migrations

The schema is managed with [umzug](https://github.com/sequelize/umzug) migrations in `server/migrations/`.
They run automatically on server start. To run them manually:

```bash
cd server
npm run migrate -- up        # apply pending migrations
npm run migrate -- pending   # list pending migrations
npm run migrate -- down      # revert the last migration
```

Databases created by older versions (via `sequelize.sync`) are detected and upgraded in place.
Schema changes must be added as a new numbered migration; models are no longer synced into the database.

### Scripts

| Where | Command | What it does |
|---|---|---|
| root | `npm run dev` | API and client in watch mode |
| server | `npm test` | API tests (jest + supertest) against a Postgres database whose name ends in `_test` (default `asset_manager_test`) |
| server | `npm run lint` | ESLint |
| client | `npm run lint` | ESLint, no warnings allowed |
| client | `npm run build` | Production build |

CI (`.github/workflows/ci.yml`) runs lint, tests and the build on every pull request.

## API Endpoints

All endpoints except register, login and refresh require `Authorization: Bearer <access token>`.

| Area | Endpoints |
|---|---|
| Auth `/api/auth` | `POST /register`, `POST /login`, `POST /login/mfa`, `POST /login/email-otp`, `POST /refresh`, `GET /profile`, `PUT /profile`, `POST /change-password` |
| MFA `/api/mfa` | `GET /status`, `POST /setup/totp`, `POST /setup/verify`, `POST /disable`, `POST /backup-codes/regenerate` |
| Settings `/api/settings` | `GET /notifications`, `PUT /notifications` |
| Investments `/api/investments` | `GET /`, `POST /`, `POST /bulk`, `GET /summary/category`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /:id/value`, `GET /:id/history` |
| Portfolio `/api/portfolio` | `GET /overview`, `GET /analytics/monthly`, `GET /analytics/stacked`, `POST /snapshot` |
| Assets `/api/assets` | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`, `GET /:id/valuations`, `POST /:id/valuations` |
| Liabilities `/api/liabilities` | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` |
| Income `/api/income` | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` |
| Budget `/api/budget` | `GET /categories`, `POST /categories`, `PUT /categories/:id`, `DELETE /categories/:id`, `GET /entries`, `POST /entries` |
| Goals `/api/goals` | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`, `GET /:id/projection`, `GET /:id/projection/montecarlo` |
| Optimizer `/api/optimizer` | `GET /health`, `GET /tax-loss`, `GET /recommendations` |

Deleting investments, assets and liabilities archives them (`isActive = false`); archived items are excluded from totals.

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
Set either the `EMAIL_*` SMTP variables or `GMAIL_USER` + `GMAIL_APP_PASSWORD` in `server/.env` (see `server/.env.example`).
Login codes, security alerts and investment updates all use the same mailer.

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