const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

// Straight-line book value; currentValue stores the purchase value when a depreciation rate is set
const bookValue = (asset, now = new Date()) => {
  const base = parseFloat(asset.currentValue || 0);
  if (!asset.depreciationRate || !asset.purchaseDate) return base;
  const years = Math.max(0, (now - new Date(asset.purchaseDate)) / MS_PER_YEAR);
  const value = base * (1 - (parseFloat(asset.depreciationRate) / 100) * years);
  return value > 0 ? parseFloat(value.toFixed(2)) : 0;
};

module.exports = { bookValue };
