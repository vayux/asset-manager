const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { Liability } = require('../models');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// GET liabilities
router.get('/', async (req, res) => {
  try {
    const { active = 'true' } = req.query;
    const where = { userId: req.user.id };
    if (active !== 'all') {
      where.isActive = active === 'true';
    }
    const liabilities = await Liability.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json({ liabilities });
  } catch (err) {
    console.error('Fetch liabilities error:', err);
    res.status(500).json({ message: 'Failed to fetch liabilities' });
  }
});

// POST liability
router.post('/', [
  body('name').notEmpty().trim().withMessage('Liability name is required'),
  body('category').isIn(['loan', 'credit_card', 'mortgage', 'tax', 'other']).withMessage('Invalid category'),
  body('outstandingAmount').isFloat({ min: 0 }).withMessage('Outstanding amount must be positive'),
  body('assetId').optional().isUUID().withMessage('Invalid asset ID'),
  body('interestRate').optional().isFloat({ min: 0, max: 100 }),
  body('dueDate').optional().isISO8601().toDate(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation errors', errors: errors.array() });
  }
  try {
    const liability = await Liability.create({ ...req.body, userId: req.user.id });
    res.status(201).json({ message: 'Liability created', liability });
  } catch (err) {
    console.error('Create liability error:', err);
    res.status(500).json({ message: 'Failed to create liability' });
  }
});

// PUT liability
router.put('/:id', [
  param('id').isUUID().withMessage('Invalid liability ID'),
  body('name').optional().notEmpty().trim(),
  body('category').optional().isIn(['loan', 'credit_card', 'mortgage', 'tax', 'other']),
  body('outstandingAmount').optional().isFloat({ min: 0 }),
  body('assetId').optional().isUUID().withMessage('Invalid asset ID'),
  body('interestRate').optional().isFloat({ min: 0, max: 100 }),
  body('dueDate').optional().isISO8601().toDate(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation errors', errors: errors.array() });
  }
  try {
    const liability = await Liability.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!liability) return res.status(404).json({ message: 'Liability not found' });

    await liability.update(req.body);
    res.json({ message: 'Liability updated', liability });
  } catch (err) {
    console.error('Update liability error:', err);
    res.status(500).json({ message: 'Failed to update liability' });
  }
});

// DELETE liability (soft)
router.delete('/:id', [param('id').isUUID().withMessage('Invalid liability ID')], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation errors', errors: errors.array() });
  }
  try {
    const liability = await Liability.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!liability) return res.status(404).json({ message: 'Liability not found' });

    await liability.update({ isActive: false });
    res.json({ message: 'Liability archived' });
  } catch (err) {
    console.error('Delete liability error:', err);
    res.status(500).json({ message: 'Failed to delete liability' });
  }
});

module.exports = router; 