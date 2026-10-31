const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { Goal, Investment, Asset, Liability } = require('../models');
const authMiddleware = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const pick = require('../utils/pick');

const router = express.Router();
router.use(authMiddleware);

const GOAL_FIELDS = ['name', 'description', 'targetAmount', 'targetDate', 'currentAmount', 'monthlyContribution', 'scope'];
const MAX_PROJECTION_MONTHS = 600;

const monthsUntil = (targetDate) => Math.min(
  MAX_PROJECTION_MONTHS,
  Math.max(1, Math.round((new Date(targetDate) - new Date()) / (30 * 24 * 60 * 60 * 1000))),
);

// List goals
router.get('/', async (req, res) => {
  const goals = await Goal.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']] });
  res.json({ goals });
});

// Create goal
router.post('/', [
  body('name').notEmpty(),
  body('targetAmount').isFloat({ min: 0.01 }),
  body('targetDate').isISO8601(),
  body('scope').optional().isIn(['investments','net_worth']),
  body('currentAmount').optional().isFloat({ min: 0 }),
  body('monthlyContribution').optional().isFloat({ min: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const goal = await Goal.create({
    userId: req.user.id,
    name: req.body.name,
    description: req.body.description || '',
    targetAmount: req.body.targetAmount,
    targetDate: req.body.targetDate,
    currentAmount: req.body.currentAmount || 0,
    monthlyContribution: req.body.monthlyContribution || 0,
    scope: req.body.scope || 'investments',
  });
  res.status(201).json({ goal });
});

// Update goal
router.put('/:id', [
  param('id').isUUID(),
  body('name').optional().notEmpty(),
  body('targetAmount').optional().isFloat({ min: 0.01 }),
  body('targetDate').optional().isISO8601(),
  body('currentAmount').optional().isFloat({ min: 0 }),
  body('monthlyContribution').optional().isFloat({ min: 0 }),
  body('scope').optional().isIn(['investments','net_worth']),
  handleValidation,
], async (req, res) => {
  const goal = await Goal.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!goal) return res.status(404).json({ message: 'Not found' });
  await goal.update(pick(req.body, GOAL_FIELDS));
  res.json({ goal });
});

// Delete goal
router.delete('/:id', [ param('id').isUUID(), handleValidation ], async (req, res) => {
  const goal = await Goal.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!goal) return res.status(404).json({ message: 'Not found' });
  await goal.destroy();
  res.json({ message: 'Deleted' });
});

// Projection endpoint
router.get('/:id/projection', [ param('id').isUUID(), query('contribution').optional().isFloat({ min: 0 }), query('months').optional().isInt({ min: 1, max: MAX_PROJECTION_MONTHS }), handleValidation ], async (req, res) => {
  const goal = await Goal.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!goal) return res.status(404).json({ message: 'Not found' });
  const contribution = parseFloat(req.query.contribution || goal.monthlyContribution || 0);
  const today = new Date();
  const monthsToTarget = req.query.months ? parseInt(req.query.months, 10) : monthsUntil(goal.targetDate);
  const data = [];
  let amount = parseFloat(goal.currentAmount || 0);
  for (let m = 0; m <= monthsToTarget; m++) {
    data.push({
      monthOffset: m,
      date: new Date(today.getFullYear(), today.getMonth() + m, 1),
      amount: parseFloat(amount.toFixed(2)),
    });
    amount += contribution;
  }
  res.json({ projection: data });
});

router.get('/:id/projection/montecarlo', [ param('id').isUUID(), query('contribution').optional().isFloat({ min: 0 }), query('sims').optional().isInt({ min: 100, max: 5000 }), handleValidation ], async (req, res) => {
  const goal = await Goal.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!goal) return res.status(404).json({ message: 'Not found' });
  const contribution = parseFloat(req.query.contribution || goal.monthlyContribution || 0);
  const sims = parseInt(req.query.sims || '1000', 10);
  const meanReturn = 0.005; // 0.5% monthly mean
  const stdDev = 0.03; // 3% monthly std dev
  const today = new Date();
  const monthsToTarget = monthsUntil(goal.targetDate);

  // Determine starting amount
  let baseAmount = parseFloat(goal.currentAmount || 0);
  if (goal.scope === 'net_worth') {
    try {
      const [investments, assets, liabilities] = await Promise.all([
        Investment.findAll({ where: { userId: req.user.id, isActive: true } }),
        Asset.findAll({ where: { userId: req.user.id, isActive: true } }),
        Liability.findAll({ where: { userId: req.user.id, isActive: true } }),
      ]);
      const invTotal = investments.reduce((s, i) => s + parseFloat(i.currentAmount || 0), 0);
      const assetTotal = assets.reduce((s, a) => s + parseFloat(a.currentValue || 0), 0);
      const liabTotal = liabilities.reduce((s, l) => s + parseFloat(l.outstandingAmount || 0), 0);
      baseAmount = invTotal + assetTotal - liabTotal;
    } catch (err) {
      console.error('Net-worth base amount calc error:', err);
    }
  }

  // helper random normal (Box–Muller)
  const randNorm = ()=>{
    let u=0,v=0; while(u===0) u=Math.random(); while(v===0) v=Math.random();
    return Math.sqrt(-2.0*Math.log(u))*Math.cos(2.0*Math.PI*v);
  };

  const monthArrays = Array.from({length: monthsToTarget+1}, ()=>[]);
  let success=0;
  for(let s=0; s<sims; s++){
    let amt = baseAmount;
    for(let m=0; m<=monthsToTarget; m++){
      monthArrays[m].push(amt);
      if(m===monthsToTarget && amt>=goal.targetAmount) success++;
      if(m===monthsToTarget) break;
      const growth = meanReturn + stdDev*randNorm();
      amt = amt*(1+growth) + contribution;
    }
  }

  const percentiles = monthArrays.map((values, idx)=>{
    values.sort((a,b)=>a-b);
    const p = (q)=> values[Math.floor(q*values.length)];
    return {monthOffset: idx, p10: p(0.10).toFixed(2), p50: p(0.50).toFixed(2), p90: p(0.90).toFixed(2)};
  });

  res.json({ successProbability: (success/sims).toFixed(3), percentiles });
});

module.exports = router; 