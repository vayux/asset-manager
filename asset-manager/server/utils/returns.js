const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const yearsBetween = (from, to) => (new Date(to) - new Date(from)) / YEAR_MS;

const cagr = (start, end, years) => {
  if (!(start > 0) || !(end >= 0) || !(years > 0)) return null;
  return (end / start) ** (1 / years) - 1;
};

// Annualised internal rate of return for dated cash flows (negative = money in, positive = value out)
const xirr = (cashflows) => {
  const flows = cashflows
    .map(f => ({ amount: Number(f.amount), time: new Date(f.date).getTime() }))
    .filter(f => f.amount !== 0 && Number.isFinite(f.amount) && Number.isFinite(f.time));
  if (!flows.some(f => f.amount < 0) || !flows.some(f => f.amount > 0)) return null;
  const t0 = Math.min(...flows.map(f => f.time));
  const npv = (rate) => flows.reduce((sum, f) => sum + f.amount / (1 + rate) ** ((f.time - t0) / YEAR_MS), 0);

  let lo = -0.9999;
  let hi = 100;
  let npvLo = npv(lo);
  if (npvLo * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    const npvMid = npv(mid);
    if (Math.abs(npvMid) < 1e-7) return mid;
    if (npvLo * npvMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      npvLo = npvMid;
    }
  }
  return (lo + hi) / 2;
};

module.exports = { yearsBetween, cagr, xirr };
