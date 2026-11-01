const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { Asset } = require('../models');
const { AssetValuation } = require('../models');
const authMiddleware = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const pick = require('../utils/pick');
const { bookValue } = require('../utils/depreciation');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

const ASSET_FIELDS = ['name', 'category', 'currentValue', 'purchaseDate', 'depreciationRate', 'description'];

// GET /api/assets - list assets (optional active param)
router.get('/', async (req, res) => {
  try {
    const { active = 'true' } = req.query;
    const where = { userId: req.user.id };
    if (active !== 'all') {
      where.isActive = active === 'true';
    }
    const assets = await Asset.findAll({ where, order: [['createdAt', 'DESC']] });

    const now = new Date();
    const transformed = assets.map((a) => {
      const plain = a.get({ plain: true });
      const computed = bookValue(plain, now);
      if (plain.depreciationRate && plain.purchaseDate) {
        plain.originalValue = parseFloat(plain.currentValue);
        plain.currentValue = computed;
      }
      plain.bookValue = computed;
      return plain;
    });

    res.json({ assets: transformed });
  } catch (err) {
    console.error('Fetch assets error:', err);
    res.status(500).json({ message: 'Failed to fetch assets' });
  }
});

// POST /api/assets - create asset
router.post('/', [
  body('name').notEmpty().trim().withMessage('Asset name is required'),
  body('category').isIn(['cash', 'real_estate', 'vehicle', 'business', 'collectible', 'stocks', 'gadgets', 'other']).withMessage('Invalid category'),
  body('currentValue').isFloat({ min: 0 }).withMessage('Current value must be positive'),
  body('purchaseDate').optional().isISO8601().toDate(),
  body('depreciationRate').optional().isFloat({ min: 0, max: 100 }).withMessage('Depreciation rate must be between 0 and 100'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation errors', errors: errors.array() });
  }
  try {
    const asset = await Asset.create({ ...pick(req.body, ASSET_FIELDS), userId: req.user.id });
    res.status(201).json({ message: 'Asset created', asset });
  } catch (err) {
    console.error('Create asset error:', err);
    res.status(500).json({ message: 'Failed to create asset' });
  }
});

// PUT /api/assets/:id - update
router.put('/:id', [
  param('id').isUUID().withMessage('Invalid asset ID'),
  body('name').optional().notEmpty().trim(),
  body('category').optional().isIn(['cash', 'real_estate', 'vehicle', 'business', 'collectible', 'stocks', 'gadgets', 'other']).withMessage('Invalid category'),
  body('currentValue').optional().isFloat({ min: 0 }),
  body('purchaseDate').optional().isISO8601().toDate(),
  body('depreciationRate').optional().isFloat({ min: 0, max: 100 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation errors', errors: errors.array() });
  }
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    await asset.update(pick(req.body, ASSET_FIELDS));
    res.json({ message: 'Asset updated', asset });
  } catch (err) {
    console.error('Update asset error:', err);
    res.status(500).json({ message: 'Failed to update asset' });
  }
});

// DELETE /api/assets/:id - soft delete (set isActive=false)
router.delete('/:id', [param('id').isUUID().withMessage('Invalid asset ID')], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation errors', errors: errors.array() });
  }
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    await asset.update({ isActive: false });
    res.json({ message: 'Asset archived' });
  } catch (err) {
    console.error('Delete asset error:', err);
    res.status(500).json({ message: 'Failed to delete asset' });
  }
});

// GET valuations for asset
router.get('/:id/valuations', [param('id').isUUID().withMessage('Invalid asset ID'), handleValidation], async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await Asset.findOne({ where: { id, userId: req.user.id } });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    const valuations = await AssetValuation.findAll({ where: { assetId: id }, order: [['valuationDate','ASC']] });
    res.json({ valuations });
  } catch(err){
    console.error('Fetch valuations error:', err);
    res.status(500).json({ message: 'Failed to fetch valuations' });
  }
});

// POST new valuation
router.post('/:id/valuations', [
  param('id').isUUID().withMessage('Invalid asset ID'),
  body('valuationDate').isISO8601().withMessage('Valid valuation date required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation errors', errors: errors.array() });
  }
  try {
    const { id } = req.params;
    const asset = await Asset.findOne({ where: { id, userId: req.user.id } });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    const { valuationDate, amount } = req.body;
    const valuation = await AssetValuation.create({ assetId: id, valuationDate, amount });
    res.status(201).json({ message: 'Valuation added', valuation });
  } catch(err){
    console.error('Create valuation error:', err);
    res.status(500).json({ message: 'Failed to add valuation' });
  }
});

module.exports = router; 