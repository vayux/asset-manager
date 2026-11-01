const express = require('express');
const { body, query } = require('express-validator');
const { Investment, InvestmentHistory, PortfolioSnapshot } = require('../models');
const authMiddleware = require('../middleware/auth');
const { handleValidation, MONTH_REGEX } = require('../middleware/validate');
const { createSnapshot } = require('../utils/snapshots');
const { yearsBetween, cagr, xirr } = require('../utils/returns');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

const validateLimit = [query('limit').optional().isInt({ min: 1, max: 120 }).toInt(), handleValidation];


const monthEnd = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

const lastMonths = (limit) => {
  const now = new Date();
  return Array.from({ length: limit }, (_, k) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (limit - 1 - k), 1))
    .toISOString().slice(0, 7));
};

const startDate = (inv) => String(inv.investmentDate || new Date(inv.createdAt).toISOString()).slice(0, 10);

// Loads active holdings with their valuation history. valueAt(inv, month) is the holding's month-end value:
// null before it was bought, today's value for the current month, otherwise the latest valuation on or
// before that month end (its initial amount before the first valuation).
const loadHoldings = async (userId) => {
  const investments = await Investment.findAll({ where: { userId, isActive: true }, raw: true });
  const histories = investments.length ? await InvestmentHistory.findAll({
    where: { investmentId: investments.map(inv => inv.id) },
    attributes: ['investmentId', 'valuationDate', 'amount'],
    order: [['valuationDate', 'ASC']],
    raw: true,
  }) : [];
  const byInvestment = {};
  histories.forEach((h) => { (byInvestment[h.investmentId] = byInvestment[h.investmentId] || []).push(h); });
  const currentMonth = new Date().toISOString().slice(0, 7);

  const valueAt = (inv, month) => {
    const end = monthEnd(month);
    if (startDate(inv) > end) return null;
    if (month >= currentMonth) return parseFloat(inv.currentAmount || 0);
    const known = (byInvestment[inv.id] || []).filter(h => String(h.valuationDate) <= end).pop();
    return parseFloat((known ? known.amount : (inv.initialAmount ?? inv.currentAmount)) || 0);
  };
  return { investments, valueAt };
};

const round2 = (n) => parseFloat(n.toFixed(2));

// Holdings and values as of a month end (default: today)
router.get('/overview', [query('month').optional().matches(MONTH_REGEX).withMessage('month must be YYYY-MM'), handleValidation], async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const { investments, valueAt } = await loadHoldings(req.user.id);
  const held = investments
    .map(inv => ({ ...inv, currentAmount: valueAt(inv, month) }))
    .filter(inv => inv.currentAmount !== null);

  const totalValue = round2(held.reduce((sum, inv) => sum + inv.currentAmount, 0));
  const categoryBreakdown = held.reduce((acc, inv) => {
    acc[inv.category] = acc[inv.category] || { count: 0, totalAmount: 0 };
    acc[inv.category].count += 1;
    acc[inv.category].totalAmount = round2(acc[inv.category].totalAmount + inv.currentAmount);
    return acc;
  }, {});

  res.json({ month, totalValue, totalInvestments: held.length, categoryBreakdown, investments: held });
});

// Month-end portfolio value for the last N months, rebuilt from valuation history
router.get('/analytics/monthly', validateLimit, async (req, res) => {
  const { investments, valueAt } = await loadHoldings(req.user.id);
  const data = lastMonths(req.query.limit || 12).map(month => ({
    month,
    total: round2(investments.reduce((sum, inv) => sum + (valueAt(inv, month) || 0), 0)),
  }));
  res.json({ data });
});

// Same month-end values split by category; each month's rows add up to the monthly total
router.get('/analytics/stacked', validateLimit, async (req, res) => {
  const { investments, valueAt } = await loadHoldings(req.user.id);
  const rows = [];
  lastMonths(req.query.limit || 12).forEach((month) => {
    const byCategory = {};
    investments.forEach((inv) => {
      const value = valueAt(inv, month);
      if (value !== null) byCategory[inv.category] = (byCategory[inv.category] || 0) + value;
    });
    Object.entries(byCategory).forEach(([category, total]) => rows.push({ month, category, total: round2(total) }));
  });
  res.json({ data: rows });
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