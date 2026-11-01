const express = require('express');
const { parseCsv } = require('../utils/csv');
const { body, validationResult, param, query } = require('express-validator');
const { Investment, InvestmentHistory } = require('../models');
const authMiddleware = require('../middleware/auth');
const { Op } = require('sequelize');
const { format } = require('date-fns');
const { sendInvestmentUpdate } = require('../utils/emailService');
const { handleValidation, MONTH_REGEX } = require('../middleware/validate');
const pick = require('../utils/pick');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

const INVESTMENT_CATEGORIES = [
  'bank_account',
  'fixed_deposit',
  'recurring_deposit',
  'stocks',
  'mutual_funds',
  'provident_fund',
  'insurance',
  'gold',
  'real_estate',
  'crypto',
  'personal_loan',
  'other',
];

const INVESTMENT_FIELDS = [
  'name',
  'category',
  'subCategory',
  'currentAmount',
  'initialAmount',
  'interestRate',
  'maturityDate',
  'accountNumber',
  'institutionName',
  'description',
  'investmentDate',
];

// helper
const getMonthRange = (monthStr) => {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
};

// Get investment summary by category
router.get('/summary/category', async (req, res) => {
  try {
    const { sequelize } = require('../config/database');
    
    const summary = await Investment.findAll({
      where: {
        userId: req.user.id,
        isActive: true,
      },
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('current_amount')), 'totalAmount'],
      ],
      group: ['category'],
      raw: true,
    });

    res.json({ summary });
  } catch (error) {
    console.error('Investment summary error:', error);
    res.status(500).json({ message: 'Failed to fetch investment summary' });
  }
});

// Get all investments for the authenticated user
router.get('/', [
  query('month').optional().matches(MONTH_REGEX).withMessage('month must be YYYY-MM'),
  handleValidation,
], async (req, res) => {
  try {
    const { category, active = 'true', month, includeHistory } = req.query;
    
    const whereClause = { userId: req.user.id };
    if (category) {
      whereClause.category = category;
    }
    if (active !== 'all') {
      whereClause.isActive = active === 'true';
    }

    if (month) {
      const { start, end } = getMonthRange(month);
      whereClause.investmentDate = { [Op.between]: [start, end] };
    }

    // Build include array conditionally
    const include = [];
    if (includeHistory === 'true') {
      include.push({
        model: InvestmentHistory,
        as: 'history',
        attributes: ['valuationDate', 'amount'],
        required: false,
        // history will be sorted later on the front-end as Sequelize doesn't guarantee ordering inside nested include
      });
    }

    const investments = await Investment.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      include,
    });

    res.json({ investments });
  } catch (error) {
    console.error('Fetch investments error:', error);
    res.status(500).json({ message: 'Failed to fetch investments' });
  }
});

// Get investment by ID
router.get('/:id', [
  param('id').isUUID().withMessage('Invalid investment ID'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const investment = await Investment.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id 
      }
    });

    if (!investment) {
      return res.status(404).json({ message: 'Investment not found' });
    }

    res.json({ investment });
  } catch (error) {
    console.error('Fetch investment error:', error);
    res.status(500).json({ message: 'Failed to fetch investment' });
  }
});

// Create new investment
router.post('/', [
  body('name').notEmpty().trim().withMessage('Investment name is required'),
  body('category').isIn(INVESTMENT_CATEGORIES).withMessage('Invalid category'),
  body('currentAmount').isFloat({ min: 0 }).withMessage('Current amount must be a positive number'),
  body('initialAmount').optional().isFloat({ min: 0 }),
  body('interestRate').optional().isFloat({ min: 0, max: 100 }),
  body('maturityDate').optional().isISO8601(),
  body('investmentDate').optional().isISO8601(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const investmentData = {
      ...pick(req.body, INVESTMENT_FIELDS),
      userId: req.user.id,
    };

    // If no investmentDate provided, default to today so that portfolio analytics work correctly
    if (!investmentData.investmentDate) {
      investmentData.investmentDate = format(new Date(), 'yyyy-MM-dd');
    }

    const investment = await Investment.create(investmentData);

    // Send investment update email
    try {
      await sendInvestmentUpdate(
        req.user,
        'New Investment Added',
        investment.name,
        investment.currentAmount
      );
    } catch (emailError) {
      console.error('Failed to send investment creation notification:', emailError);
      // Don't fail the investment creation if email fails
    }

    res.status(201).json({
      message: 'Investment created successfully',
      investment,
    });
  } catch (error) {
    console.error('Create investment error:', error);
    res.status(500).json({ message: 'Failed to create investment' });
  }
});

// Update investment
router.put('/:id', [
  param('id').isUUID().withMessage('Invalid investment ID'),
  body('name').optional().notEmpty().trim(),
  body('category').optional().isIn(INVESTMENT_CATEGORIES),
  body('currentAmount').optional().isFloat({ min: 0 }),
  body('initialAmount').optional().isFloat({ min: 0 }),
  body('interestRate').optional().isFloat({ min: 0, max: 100 }),
  body('maturityDate').optional().isISO8601(),
  body('investmentDate').optional().isISO8601(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const investment = await Investment.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id 
      }
    });

    if (!investment) {
      return res.status(404).json({ message: 'Investment not found' });
    }

    const prevAmount = investment.currentAmount;
    const prevDate = investment.investmentDate;

    await investment.update(pick(req.body, INVESTMENT_FIELDS));

    // If amount or date changed, add history entry
    if ((req.body.currentAmount && req.body.currentAmount != prevAmount) || (req.body.investmentDate && req.body.investmentDate !== prevDate)) {
      const valuationDate = req.body.investmentDate || format(new Date(), 'yyyy-MM-dd');
      await InvestmentHistory.create({
        investmentId: investment.id,
        valuationDate,
        amount: req.body.currentAmount || prevAmount,
      });

      // Send investment update email if amount changed significantly
      if (req.body.currentAmount && Math.abs(req.body.currentAmount - prevAmount) > 0) {
        try {
          await sendInvestmentUpdate(
            req.user,
            'Investment Value Updated',
            investment.name,
            req.body.currentAmount
          );
        } catch (emailError) {
          console.error('Failed to send investment update notification:', emailError);
          // Don't fail the investment update if email fails
        }
      }
    }

    res.json({ message: 'Investment updated successfully', investment });
  } catch (error) {
    console.error('Update investment error:', error);
    res.status(500).json({ message: 'Failed to update investment' });
  }
});

// Delete investment (soft delete by setting isActive to false)
router.delete('/:id', [
  param('id').isUUID().withMessage('Invalid investment ID'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const investment = await Investment.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id 
      }
    });

    if (!investment) {
      return res.status(404).json({ message: 'Investment not found' });
    }

    await investment.update({ isActive: false });

    res.json({ message: 'Investment deleted successfully' });
  } catch (error) {
    console.error('Delete investment error:', error);
    res.status(500).json({ message: 'Failed to delete investment' });
  }
});

// Update investment value (create history)
router.post('/:id/value', [
  param('id').isUUID(),
  body('amount').isFloat({ min: 0 }),
  body('valuationDate').isISO8601(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation errors', errors: errors.array() });
    }

    const { amount, valuationDate } = req.body;
    const investment = await Investment.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!investment) return res.status(404).json({ message: 'Investment not found' });

    // Create history entry
    await InvestmentHistory.create({
      investmentId: investment.id,
      valuationDate,
      amount,
    });

    // Update current amount & date
    await investment.update({ currentAmount: amount, investmentDate: valuationDate });

    res.json({ message: 'Value updated', investment });
  } catch (e) {
    console.error('update value error', e);
    res.status(500).json({ message: 'Failed to update value' });
  }
});

// Get history for investment
router.get('/:id/history', [param('id').isUUID()], async (req,res)=>{
  try{
    const errors = validationResult(req);
    if(!errors.isEmpty()) return res.status(400).json({message:'Invalid id'});
    const investment = await Investment.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!investment) return res.status(404).json({ message: 'Investment not found' });
    const histories = await InvestmentHistory.findAll({
      where:{investmentId:req.params.id},
      order:[['valuationDate','ASC']],
      raw:true,
    });
    res.json({histories});
  }catch(e){
    console.error('history error',e);
    res.status(500).json({message:'Failed to fetch history'});
  }
});

// Bulk create investments
router.post('/bulk', [
  body().isArray({min:1}).withMessage('Array required'),
  body('*.name').notEmpty(),
  body('*.category').optional().isIn(INVESTMENT_CATEGORIES),
  body('*.currentAmount').isFloat({min:0}),
  body('*.investmentDate').optional().isISO8601(),
], async (req,res)=>{
  const errors = validationResult(req); if(!errors.isEmpty()) return res.status(400).json({errors:errors.array()});
  try {
    const rows = req.body;
    const created = await Investment.sequelize.transaction((transaction) => Investment.bulkCreate(rows.map(r=>({
      userId: req.user.id,
      name: r.name.trim(),
      category: r.category || 'other',
      currentAmount: r.currentAmount,
      investmentDate: r.investmentDate || format(new Date(),'yyyy-MM-dd'),
    })), { validate: true, transaction }));
    res.status(201).json({created});
  }catch(err){ console.error('bulk insert failed:', err.message); res.status(500).json({message:'bulk insert failed; no investments were saved'}); }
});

// Import investments from a CSV file (header row required; name and currentAmount columns are mandatory).
// The whole file is rejected if any row is invalid.
const MAX_IMPORT_ROWS = 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
router.post('/import', express.text({ type: ['text/csv', 'text/plain'], limit: '1mb' }), async (req, res) => {
  if (typeof req.body !== 'string' || !req.body.trim()) {
    return res.status(400).json({ message: 'Send the CSV file as text/csv' });
  }
  const [header, ...lines] = parseCsv(req.body);
  const columns = header.map(h => h.trim());
  if (!columns.includes('name') || !columns.includes('currentAmount')) {
    return res.status(400).json({ message: 'CSV needs at least name and currentAmount columns' });
  }
  if (!lines.length) return res.status(400).json({ message: 'CSV has no data rows' });
  if (lines.length > MAX_IMPORT_ROWS) {
    return res.status(400).json({ message: `CSV can have at most ${MAX_IMPORT_ROWS} rows` });
  }

  const errors = [];
  const today = format(new Date(), 'yyyy-MM-dd');
  const amount = (raw, rowNo, field, required) => {
    if (raw === '' && !required) return undefined;
    const n = Number(raw.replace(/[₹,\s]/g, ''));
    if (raw === '' || !Number.isFinite(n) || n < 0) errors.push({ row: rowNo, message: `${field} must be a positive number` });
    return n;
  };
  const records = lines.map((cells, idx) => {
    const rowNo = idx + 2;
    const raw = Object.fromEntries(columns.map((c, i) => [c, (cells[i] || '').trim()]));
    if (!raw.name) errors.push({ row: rowNo, message: 'name is required' });
    const category = raw.category || 'other';
    if (!INVESTMENT_CATEGORIES.includes(category)) errors.push({ row: rowNo, message: `unknown category "${category}"` });
    if (raw.investmentDate && (!DATE_RE.test(raw.investmentDate) || Number.isNaN(Date.parse(raw.investmentDate)))) {
      errors.push({ row: rowNo, message: 'investmentDate must be YYYY-MM-DD' });
    }
    const record = {
      userId: req.user.id,
      name: raw.name.slice(0, 255),
      category,
      currentAmount: amount(raw.currentAmount || '', rowNo, 'currentAmount', true),
      investmentDate: raw.investmentDate || today,
    };
    const initialAmount = amount(raw.initialAmount || '', rowNo, 'initialAmount', false);
    if (initialAmount !== undefined) record.initialAmount = initialAmount;
    if (raw.institutionName) record.institutionName = raw.institutionName.slice(0, 255);
    if (raw.subCategory) record.subCategory = raw.subCategory.slice(0, 255);
    return record;
  });
  if (errors.length) {
    return res.status(400).json({ message: 'CSV has invalid rows; nothing was imported', errors: errors.slice(0, 50) });
  }
  const created = await Investment.sequelize.transaction(transaction => Investment.bulkCreate(records, { validate: true, transaction }));
  res.status(201).json({ imported: created.length });
});

// Export router
module.exports = router; 