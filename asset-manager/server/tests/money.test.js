const { toAmount, sumMoney } = require('../utils/money');
const { bookValue } = require('../utils/depreciation');
const { getMonthRange, monthEnd } = require('../utils/dates');

describe('money helpers', () => {
  it('sums decimal strings without float error', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumMoney(['0.10', '0.20'])).toBe(0.3);
    expect(sumMoney([{ v: '1000000.05' }, { v: '0.10' }, { v: null }], r => r.v)).toBe(1000000.15);
  });

  it('treats null, empty and garbage as zero', () => {
    expect(toAmount(null)).toBe(0);
    expect(toAmount('')).toBe(0);
    expect(toAmount('12.345')).toBe(12.35);
  });

  it('computes straight-line book value', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const asset = { currentValue: '100000.00', depreciationRate: '10', purchaseDate: '2024-01-01' };
    expect(bookValue(asset, now)).toBeCloseTo(79986.31, 1);
    expect(bookValue({ ...asset, purchaseDate: '2010-01-01' }, now)).toBe(0);
    expect(bookValue({ currentValue: '500.50' }, now)).toBe(500.5);
  });
});

describe('date helpers', () => {
  it('returns month boundaries', () => {
    expect(monthEnd('2024-02')).toBe('2024-02-29');
    const { start, end } = getMonthRange('2026-12');
    expect(start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-12-31T23:59:59.999Z');
  });
});
