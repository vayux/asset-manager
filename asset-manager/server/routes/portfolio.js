const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { Investment, InvestmentHistory, PortfolioSnapshot } = require('../models');
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
// Month-end portfolio value for the last N months, rebuilt from valuation history.
// Each investment counts from the month it was made, valued at its latest recorded valuation on or before
// that month end (its initial amount before the first valuation); the current month uses today's values.
router.get('/analytics/monthly', validateLimit, async (req, res) => {
  const limit = req.query.limit || 12;
  const investments = await Investment.findAll({
    where: { userId: req.user.id, isActive: true },
    attributes: ['id', 'currentAmount', 'initialAmount', 'investmentDate', 'createdAt'],
    raw: true,
  });
  const histories = investments.length ? await InvestmentHistory.findAll({
    where: { investmentId: investments.map(inv => inv.id) },
    attributes: ['investmentId', 'valuationDate', 'amount'],
    order: [['valuationDate', 'ASC']],
    raw: true,
  }) : [];
  const byInvestment = {};
  histories.forEach((h) => { (byInvestment[h.investmentId] = byInvestment[h.investmentId] || []).push(h); });

  const now = new Date();
  const months = Array.from({ length: limit }, (_, k) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (limit - 1 - k), 1));
    return d.toISOString().slice(0, 7);
  });
  const currentMonth = months[months.length - 1];
  const monthEnd = (month) => {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  };

  const data = months.map((month) => {
    const end = monthEnd(month);
    const total = investments.reduce((sum, inv) => {
      const start = String(inv.investmentDate || new Date(inv.createdAt).toISOString()).slice(0, 10);
      if (start > end) return sum;
      if (month === currentMonth) return sum + parseFloat(inv.currentAmount || 0);
      const known = (byInvestment[inv.id] || []).filter(h => String(h.valuationDate) <= end).pop();
      const value = known ? known.amount : (inv.initialAmount ?? inv.currentAmount);
      return sum + parseFloat(value || 0);
    }, 0);
    return { month, total: parseFloat(total.toFixed(2)) };
  });

  res.json({ data });
});

// Category totals per month (stacked bar)
router.get('/analytics/stacked', validateLimit, async (req, res) => {
  try {
    const { limit = 12 } = req.query;

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