const express = require('express');
const { query } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { SYMBOL_RE, getQuotes } = require('../utils/quotes');

const router = express.Router();

router.use(authMiddleware);

const MAX_SYMBOLS = 25;

router.get('/quotes', [
  query('symbols').isString().custom((value) => {
    const symbols = value.split(',');
    if (symbols.length > MAX_SYMBOLS) throw new Error(`At most ${MAX_SYMBOLS} symbols`);
    if (!symbols.every(s => SYMBOL_RE.test(s))) throw new Error('Symbols must be NSE tickers like HDFCBANK');
    return true;
  }),
  handleValidation,
], async (req, res) => {
  const symbols = [...new Set(req.query.symbols.split(','))];
  res.json(await getQuotes(symbols));
});

module.exports = router;
