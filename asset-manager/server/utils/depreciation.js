const { money, toAmount } = require('./money');

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

// Straight-line book value; currentValue stores the purchase value when a depreciation rate is set
const bookValue = (asset, now = new Date()) => {
  const base = toAmount(asset.currentValue);
  if (!asset.depreciationRate || !asset.purchaseDate) return base;
  const years = Math.max(0, (now - new Date(asset.purchaseDate)) / MS_PER_YEAR);
  const value = money(base).times(1 - (Number(asset.depreciationRate) / 100) * years);
  return value.gt(0) ? toAmount(value) : 0;
};

module.exports = { bookValue };
