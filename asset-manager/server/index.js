const express = require('express');
require('express-async-errors');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { sequelize } = require('./config/database');
const { validateJWTSecret } = require('./utils/security');
// Import models to ensure they are registered
require('./models');
const authRoutes = require('./routes/auth');
const mfaRoutes = require('./routes/mfa');
const settingsRoutes = require('./routes/settings');
const investmentRoutes = require('./routes/investments');
const portfolioRoutes = require('./routes/portfolio');
const assetsRoutes = require('./routes/assets');
const liabilitiesRoutes = require('./routes/liabilities');
const budgetRoutes = require('./routes/budget');
const incomeRoutes = require('./routes/income');
const goalsRoutes = require('./routes/goals');
const optimizerRoutes = require('./routes/optimizer');

const app = express();
const PORT = process.env.PORT || 5001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  hsts: process.env.NODE_ENV === 'production'
}));

// General rate limiting (more reasonable for development)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Higher limit for development
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks in development
    return process.env.NODE_ENV !== 'production' && req.path === '/api/health';
  }
});

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/mfa', mfaRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/liabilities', liabilitiesRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/optimizer', optimizerRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'MoneyMind API is running!', timestamp: new Date().toISOString() });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handling middleware (async route errors reach here via express-async-errors)
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err.stack);
  res.status(status).json({ 
    message: status >= 500 ? 'Something went wrong!' : err.message, 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error' 
  });
});

// Database connection and server start
const startServer = async () => {
  try {
    validateJWTSecret();
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    // Sync database models
    await sequelize.sync({ alter: true });
    console.log('Database synchronized.');
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;
