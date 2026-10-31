const { validationResult } = require('express-validator');

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation errors', errors: errors.array() });
  }
  next();
};

module.exports = { handleValidation, MONTH_REGEX };
