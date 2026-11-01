const express = require('express');
const { body, query } = require('express-validator');
const { Investment, InvestmentHistory, PortfolioSnapshot } = require('../models');
const authMiddleware = require('../middleware/auth');
const { handleValidation, MONTH_REGEX } = require('../middleware/validate');
const { Op } = require('sequelize');
const { createSnapshot } = require('../utils/snapshots');
const { yearsBetween, cagr, xirr } = require('../utils/returns');

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

// Net worth over time from daily (automatic) and manual snapshots
router.get('/net-worth', validateLimit, async (req, res) => {
  const rows = await PortfolioSnapshot.findAll({
    where: { userId: req.user.id },
    order: [['snapshotDate', 'DESC']],
    limit: req.query.limit || 90,
    attributes: ['snapshotDate', 'totalValue', 'totalAssets', 'totalLiabilities', 'netWorth', 'isManual'],
    raw: true,
  });
  res.json({
    data: rows.reverse().map(r => ({
      date: r.snapshotDate,
      investments: parseFloat(r.totalValue),
      assets: parseFloat(r.totalAssets),
      liabilities: parseFloat(r.totalLiabilities),
      netWorth: parseFloat(r.netWorth),
      isManual: r.isManual,
    })),
  });
});

// CAGR per holding and XIRR for the whole portfolio, treating each holding's
// initial amount as money invested on its investment date and today's value as the end value
router.get('/returns', async (req, res) => {
  const investments = await Investment.findAll({ where: { userId: req.user.id, isActive: true }, raw: true });
  const todayStr = new Date().toISOString().slice(0, 10);
  const round = (n) => (n === null ? null : Math.round(n * 10000) / 10000);
  const flows = [];
  let invested = 0;
  let current = 0;
  const holdings = investments.map((inv) => {
    const start = String(inv.investmentDate || new Date(inv.createdAt).toISOString()).slice(0, 10);
    const principal = parseFloat(inv.initialAmount ?? inv.currentAmount);
    const value = parseFloat(inv.currentAmount);
    const years = yearsBetween(start, todayStr);
    invested += principal;
    current += value;
    flows.push({ amount: -principal, date: start });
    return {
      id: inv.id,
      name: inv.name,
      category: inv.category,
      invested: principal,
      current: value,
      years: round(years),
      // Annualising holdings younger than a month gives meaningless numbers
      cagr: years >= 1 / 12 ? round(cagr(principal, value, years)) : null,
    };
  });
  flows.push({ amount: current, date: todayStr });
  res.json({
    investments: holdings,
    portfolio: {
      invested: Math.round(invested * 100) / 100,
      current: Math.round(current * 100) / 100,
      absoluteReturn: invested > 0 ? round(current / invested - 1) : null,
      xirr: investments.length ? round(xirr(flows)) : null,
    },
  });
});

// Create portfolio snapshot
router.post('/snapshot', [
  body('snapshotDate').isISO8601().withMessage('Valid snapshot date is required'),
  body('notes').optional().trim().isLength({ max: 1000 }),
  handleValidation,
], async (req, res) => {
  const { snapshotDate, notes } = req.body;
  try {
    const snapshot = await createSnapshot(req.user.id, String(snapshotDate).slice(0, 10), { isManual: true, notes });
    res.status(201).json({ message: 'Portfolio snapshot created successfully', snapshot });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Snapshot already exists for this date' });
    }
    throw error;
  }
});

module.exports = router; 