const express = require('express');
const { body, param } = require('express-validator');
const { ExchangeRate, Investment, Asset, Liability } = require('../models');
const authMiddleware = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { getRates } = require('../services/fx');
const { BASE_CURRENCY, SUPPORTED_CURRENCIES } = require('../constants/currencies');

const router = express.Router();
router.use(authMiddleware);

const currencyParam = param('currency').customSanitizer(v => String(v).toUpperCase())
  .isIn(SUPPORTED_CURRENCIES.filter(c => c !== BASE_CURRENCY)).withMessage('Unsupported currency');

// Rates for every currency the user holds or has a manual rate for
router.get('/rates', async (req, res) => {
  const userId = req.user.id;
  const opts = { where: { userId, isActive: true }, attributes: ['currency'], raw: true };
  const [inv, assets, liabs, manual] = await Promise.all([
    Investment.findAll(opts), Asset.findAll(opts), Liability.findAll(opts),
    ExchangeRate.findAll({ where: { userId }, order: [['currency', 'ASC']], raw: true }),
  ]);
  const used = [...inv, ...assets, ...liabs].map(r => r.currency);
  const { rates, missing } = await getRates(userId, [...used, ...manual.map(m => m.currency)]);
  res.json({
    base: BASE_CURRENCY,
    supported: SUPPORTED_CURRENCIES,
    rates,
    missing,
    manual: manual.map(m => ({ currency: m.currency, rate: Number(m.rateToInr), updatedAt: m.updatedAt })),
  });
});

router.put('/rates/:currency', [
  currencyParam,
  body('rate').isFloat({ gt: 0, max: 1000000 }).withMessage('Rate must be a positive number').toFloat(),
  handleValidation,
], async (req, res) => {
  const { currency } = req.params;
  const [row] = await ExchangeRate.upsert(
    { userId: req.user.id, currency, rateToInr: req.body.rate },
    { conflictFields: ['user_id', 'currency'] },
  );
  res.json({ currency, rate: Number(row.rateToInr) });
});

router.delete('/rates/:currency', [currencyParam, handleValidation], async (req, res) => {
  const deleted = await ExchangeRate.destroy({ where: { userId: req.user.id, currency: req.params.currency } });
  if (!deleted) return res.status(404).json({ message: 'No manual rate for this currency' });
  res.json({ message: 'Manual rate removed' });
});

module.exports = router;
