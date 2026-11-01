const { Investment, InvestmentHistory } = require('../models');
const { currentMonth, monthEnd } = require('../utils/dates');
const { converterFor } = require('./fx');

const startDate = (inv) => String(inv.investmentDate || new Date(inv.createdAt).toISOString()).slice(0, 10);

// Loads active holdings with their valuation history. valueAt(inv, month) is the holding's month-end value:
// null before it was bought, today's value for the current month, otherwise the latest valuation on or
// before that month end (its initial amount before the first valuation).
const loadHoldings = async (userId) => {
  const investments = await Investment.findAll({ where: { userId, isActive: true }, raw: true });
  const histories = investments.length ? await InvestmentHistory.findAll({
    where: { investmentId: investments.map(inv => inv.id) },
    attributes: ['investmentId', 'valuationDate', 'amount'],
    order: [['valuationDate', 'ASC']],
    raw: true,
  }) : [];
  const byInvestment = {};
  histories.forEach((h) => { (byInvestment[h.investmentId] = byInvestment[h.investmentId] || []).push(h); });
  const thisMonth = currentMonth();
  // Past valuations are converted at today's rate
  const convert = await converterFor(userId, investments);

  const valueAt = (inv, month) => {
    const end = monthEnd(month);
    if (startDate(inv) > end) return null;
    if (month >= thisMonth) return convert(inv.currentAmount, inv.currency);
    const known = (byInvestment[inv.id] || []).filter(h => String(h.valuationDate) <= end).pop();
    return convert(known ? known.amount : (inv.initialAmount ?? inv.currentAmount), inv.currency);
  };
  return { investments, valueAt };
};

module.exports = { loadHoldings, startDate };
