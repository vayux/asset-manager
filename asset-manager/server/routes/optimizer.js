const express = require('express');
const { query } = require('express-validator');
const { Asset, Liability, Investment, Income, BudgetEntry, BudgetCategory, Goal } = require('../models');
const { bookValue } = require('../utils/depreciation');
const authMiddleware = require('../middleware/auth');
const { handleValidation, MONTH_REGEX } = require('../middleware/validate');
const { Op } = require('sequelize');

const router = express.Router();
router.use(authMiddleware);

const validateMonth = [query('month').optional().matches(MONTH_REGEX).withMessage('month must be YYYY-MM'), handleValidation];

const LIQUID_INVESTMENT_CATEGORIES = ['bank_account', 'stocks', 'mutual_funds', 'crypto'];
const LIQUID_ASSET_CATEGORIES = ['cash', 'stocks'];
const MONTHLY_FACTOR = { weekly: 52 / 12, biweekly: 26 / 12, monthly: 1 };

const currentMonth = () => new Date().toISOString().slice(0, 7);
const sumBy = (rows, fn) => rows.reduce((total, row) => total + fn(row), 0);

// Recurring income normalised to a monthly amount; one-off income only counts in its pay month
const monthlyIncome = (incomes, month) => sumBy(incomes, (inc) => {
  const amount = parseFloat(inc.amount || 0);
  if (inc.frequency === 'once') return String(inc.nextPayDate).slice(0, 7) === month ? amount : 0;
  return amount * (MONTHLY_FACTOR[inc.frequency] || 1);
});

// Financial Health Score: balance-sheet values are current holdings; income/spending use the selected month
router.get('/health', validateMonth, async (req, res) => {
  const userId = req.user.id;
  const month = req.query.month || currentMonth();

  const [assets, liabilitiesSum, investments, incomes, spent] = await Promise.all([
    Asset.findAll({ where: { userId, isActive: true } }),
    Liability.sum('outstandingAmount', { where: { userId, isActive: true } }),
    Investment.findAll({ where: { userId, isActive: true } }),
    Income.findAll({ where: { userId } }),
    BudgetEntry.sum('spentAmount', { where: { userId, month: `${month}-01` } }),
  ]);

  const now = new Date();
  const assetValue = (a) => bookValue(a, now);
  const invValue = (i) => parseFloat(i.currentAmount || 0);

  const totalAssetValue = sumBy(assets, assetValue);
  const totalInvValue = sumBy(investments, invValue);
  const totalAssets = totalAssetValue + totalInvValue;
  const totalLiabilities = parseFloat(liabilitiesSum || 0);
  const netWorth = totalAssets - totalLiabilities;
  const debtRatio = totalAssets > 0 ? totalLiabilities / totalAssets : (totalLiabilities > 0 ? 1 : 0);

  const totalIncome = monthlyIncome(incomes, month);
  const totalSpent = parseFloat(spent || 0);
  const savingsRate = totalIncome > 0 ? Math.max(0, totalIncome - totalSpent) / totalIncome : 0;

  const categoryTotals = {};
  investments.forEach((inv) => {
    categoryTotals[inv.category] = (categoryTotals[inv.category] || 0) + invValue(inv);
  });
  const hhi = Object.values(categoryTotals).reduce((total, amt) => {
    const share = totalInvValue > 0 ? amt / totalInvValue : 0;
    return total + share * share;
  }, 0);
  const diversificationScore = totalInvValue > 0 ? Math.round((1 - hhi) * 100) : 0;

  const liquidValue = sumBy(investments.filter(i => LIQUID_INVESTMENT_CATEGORIES.includes(i.category)), invValue)
    + sumBy(assets.filter(a => LIQUID_ASSET_CATEGORIES.includes(a.category)), assetValue);
  const liquidityRatio = totalAssets > 0 ? liquidValue / totalAssets : 0;
  const liquidityScore = Math.round(Math.min(1, liquidityRatio) * 100);

  // Composite score weighting (debt 35, savings 35, diversification 15, liquidity 15)
  const score = Math.round(
    (1 - Math.min(1, debtRatio)) * 35
    + Math.min(1, savingsRate) * 35
    + diversificationScore * 0.15
    + liquidityScore * 0.15
  );

  res.json({
    netWorth,
    totalAssets,
    totalLiabilities,
    debtRatio,
    totalIncome,
    totalSpent,
    savingsRate,
    diversificationScore,
    liquidityScore,
    score,
  });
});

// Tax loss harvesting suggestions
router.get('/tax-loss', [query('threshold').optional().isFloat({ min: 0, max: 100 }), handleValidation], async (req, res) => {
  const threshold = parseFloat(req.query.threshold || 10); // percent decline
  const investments = await Investment.findAll({
    where: { userId: req.user.id, isActive: true, initialAmount: { [Op.ne]: null } },
  });
  const opportunities = investments.map((inv) => {
    const current = parseFloat(inv.currentAmount || 0);
    const initial = parseFloat(inv.initialAmount || 0);
    return { inv, current, initial, decline: initial > 0 ? ((initial - current) / initial) * 100 : 0 };
  }).filter(({ initial, decline }) => initial > 0 && decline >= threshold)
    .map(({ inv, current, initial, decline }) => ({
      id: inv.id,
      name: inv.name,
      category: inv.category,
      initialAmount: inv.initialAmount,
      currentAmount: inv.currentAmount,
      declinePercent: decline.toFixed(2),
      potentialLoss: (initial - current).toFixed(2),
    }));
  res.json({ opportunities });
});

// Personalized recommendations based on budgets and goals
router.get('/recommendations', validateMonth, async (req, res) => {
  const userId = req.user.id;
  const month = req.query.month || currentMonth();
  const recs = [];

  const entries = await BudgetEntry.findAll({
    where: { userId, month: `${month}-01` },
    include: [{ model: BudgetCategory, as: 'category', attributes: ['name'] }],
  });
  entries.forEach((e) => {
    if (parseFloat(e.spentAmount) > parseFloat(e.budgetedAmount) * 1.1) {
      recs.push(`You have overspent on "${e.category?.name || 'a budget category'}" by more than 10%. Consider reducing discretionary expenses.`);
    }
  });

  const goals = await Goal.findAll({ where: { userId } });
  const today = new Date();
  goals.forEach((g) => {
    const months = Math.max(1, Math.round((new Date(g.targetDate) - today) / (30 * 24 * 60 * 60 * 1000)));
    const target = parseFloat(g.targetAmount);
    const projected = parseFloat(g.currentAmount || 0) + months * parseFloat(g.monthlyContribution || 0);
    if (projected < target) {
      const need = ((target - projected) / months).toFixed(0);
      recs.push(`Goal "${g.name}" is off track. Increase monthly contribution by about ₹${need} to hit the target.`);
    }
  });

  res.json({ recommendations: recs });
});

module.exports = router; 