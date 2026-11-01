const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

const getMonthRange = (monthStr) => {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
};

const monthEnd = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

const lastMonths = (limit) => {
  const now = new Date();
  return Array.from({ length: limit }, (_, k) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (limit - 1 - k), 1))
    .toISOString().slice(0, 7));
};

module.exports = { today, currentMonth, getMonthRange, monthEnd, lastMonths };
