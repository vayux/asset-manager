const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const { Investment, PortfolioSnapshot, InvestmentHistory } = require('../models');
const authMiddleware = require('../middleware/auth');
const { handleValidation, MONTH_REGEX } = require('../middleware/validate');
const { Op } = require('sequelize');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

const validateLimit = [query('limit').optional().isInt({ min: 1, max: 120 }).toInt(), handleValidation];

// Helper to get first and last day of a month
const getMonthRange = (monthStr) => {
  // monthStr format: YYYY-MM
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)); // last day of month
  return { start, end };
};

// Modify portfolio overview with optional month filter
router.get('/overview', [query('month').optional().matches(MONTH_REGEX).withMessage('month must be YYYY-MM'), handleValidation], async (req, res) => {
  try {
    const { month } = req.query; // YYYY-MM

    const whereClause = {
      userId: req.user.id,
      isActive: true,
    };

    if (month) {
      const { start, end } = getMonthRange(month);
      whereClause.investmentDate = { [Op.between]: [start, end] };
    }

    const investments = await Investment.findAll({ where: whereClause });

    const totalValue = investments.reduce((sum, investment) => sum + parseFloat(investment.currentAmount), 0);

    const categoryBreakdown = investments.reduce((acc, investment) => {
      const category = investment.category;
      if (!acc[category]) {
        acc[category] = { count: 0, totalAmount: 0 };
      }
      acc[category].count += 1;
      acc[category].totalAmount += parseFloat(investment.currentAmount);
      return acc;
    }, {});

    res.json({ totalValue, totalInvestments: investments.length, categoryBreakdown, investments });
  } catch (error) {
    console.error('Portfolio overview error:', error);
    res.status(500).json({ message: 'Failed to fetch portfolio overview' });
  }
});

// Monthly analytics: returns totals per month for last N months
router.get('/analytics/monthly', validateLimit, async (req, res) => {
  try {
    const { limit = 12 } = req.query;

    // Fetch active investments for the user
    const investments = await Investment.findAll({
      where: { userId: req.user.id, isActive: true },
      attributes: ['currentAmount', 'investmentDate', 'createdAt'],
      raw: true,
    });

    // Aggregate totals by month (YYYY-MM) – fall back to createdAt when investmentDate is null
    const monthlyTotals = investments.reduce((acc, inv) => {
      const dateObj = inv.investmentDate ? new Date(inv.investmentDate) : new Date(inv.createdAt);
      if (isNaN(dateObj)) return acc;
      const monthKey = dateObj.toISOString().substring(0, 7);
      acc[monthKey] = (acc[monthKey] || 0) + parseFloat(inv.currentAmount);
      return acc;
    }, {});

    // Build sorted array and apply limit (last N months)
    const sortedMonths = Object.keys(monthlyTotals).sort();
    const slicedMonths = sortedMonths.slice(-parseInt(limit, 10));
    const data = slicedMonths.map((m) => ({ month: m, total: monthlyTotals[m] }));

    res.json({ data });
  } catch (error) {
    console.error('Monthly analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch monthly analytics' });
  }
});

// Category totals per month (stacked bar)
router.get('/analytics/stacked', validateLimit, async (req, res) => {
  try {
    const { limit = 12 } = req.query;
    const { sequelize } = require('../config/database');

    // Build target months list (last N months inclusive of current)
    const now = new Date();
    const monthKeys = [];
    for(let i=limit-1;i>=0;i--){
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()-i, 1));
      monthKeys.push(d.toISOString().substring(0,7));
    }

    // Fetch active investments with basic fields
    const investments = await Investment.findAll({
       where: { userId: req.user.id, isActive: true },
       attributes:['category','currentAmount','investmentDate','createdAt'],
       raw:true,
     });

    const resultMap = {};
    monthKeys.forEach(m=>{ resultMap[m]={}; });

    investments.forEach(inv=>{
      const amount = parseFloat(inv.currentAmount);
      const month = (inv.investmentDate ? new Date(inv.investmentDate): new Date(inv.createdAt)).toISOString().substring(0,7);
      if(monthKeys.includes(month)){
        if(!resultMap[month][inv.category]) resultMap[month][inv.category] = 0;
        resultMap[month][inv.category] += amount;
      }
    });

    const rows=[];
    monthKeys.forEach(m=>{
      Object.entries(resultMap[m]).forEach(([cat,total])=>{
        rows.push({month:m,category:cat,total});
      });
    });

    res.json({ data: rows });
  } catch(err){
    console.error('stacked analytics error', err);
    res.status(500).json({message:'Failed to fetch stacked analytics'});
  }
});

// Create portfolio snapshot
router.post('/snapshot', [
  body('snapshotDate').isISO8601().withMessage('Valid snapshot date is required'),
  body('notes').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { snapshotDate, notes } = req.body;

    // Check if snapshot already exists for this date
    const existingSnapshot = await PortfolioSnapshot.findOne({
      where: {
        userId: req.user.id,
        snapshotDate,
      },
    });

    if (existingSnapshot) {
      return res.status(409).json({ message: 'Snapshot already exists for this date' });
    }

    // Get current investments
    const investments = await Investment.findAll({
      where: {
        userId: req.user.id,
        isActive: true,
      },
    });

    const totalValue = investments.reduce((sum, investment) => {
      return sum + parseFloat(investment.currentAmount);
    }, 0);

    const categoryBreakdown = investments.reduce((acc, investment) => {
      const category = investment.category;
      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category] += parseFloat(investment.currentAmount);
      return acc;
    }, {});

    const snapshot = await PortfolioSnapshot.create({
      userId: req.user.id,
      snapshotDate,
      totalValue,
      categoryBreakdown,
      investments: investments.map(inv => ({
        id: inv.id,
        name: inv.name,
        category: inv.category,
        subCategory: inv.subCategory,
        amount: inv.currentAmount,
        institutionName: inv.institutionName,
      })),
      notes,
      isManual: true,
    });

    res.status(201).json({
      message: 'Portfolio snapshot created successfully',
      snapshot,
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Snapshot already exists for this date' });
    }
    console.error('Create snapshot error:', error);
    res.status(500).json({ message: 'Failed to create portfolio snapshot' });
  }
});

module.exports = router; 