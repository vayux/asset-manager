const Decimal = require('decimal.js');

// Money is stored as numeric(15,2); arithmetic goes through Decimal so sums don't pick up float error
const money = (value) => {
  if (value === null || value === undefined || value === '') return new Decimal(0);
  const d = new Decimal(value);
  return d.isFinite() ? d : new Decimal(0);
};

const toAmount = (value) => money(value).toDecimalPlaces(2).toNumber();

const sumMoney = (rows, pickValue = (v) => v) => rows
  .reduce((total, row) => total.plus(money(pickValue(row))), new Decimal(0))
  .toDecimalPlaces(2)
  .toNumber();

module.exports = { Decimal, money, toAmount, sumMoney };
