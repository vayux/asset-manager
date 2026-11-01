const { Investment, Asset, Liability, PortfolioSnapshot, User } = require('../models');
const logger = require('./logger');
const { bookValue } = require('./depreciation');

const SCHEDULE_MS = 6 * 60 * 60 * 1000;
const sum = (rows, field) => rows.reduce((total, row) => total + parseFloat(row[field] || 0), 0);
const round2 = (n) => Math.round(n * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

const buildSnapshot = async (userId) => {
  const [investments, assets, liabilities] = await Promise.all([
    Investment.findAll({ where: { userId, isActive: true } }),
    Asset.findAll({ where: { userId, isActive: true } }),
    Liability.findAll({ where: { userId, isActive: true } }),
  ]);
  const totalValue = round2(sum(investments, 'currentAmount'));
  const totalAssets = round2(assets.reduce((total, asset) => total + bookValue(asset), 0));
  const totalLiabilities = round2(sum(liabilities, 'outstandingAmount'));
  const categoryBreakdown = investments.reduce((acc, inv) => {
    acc[inv.category] = round2((acc[inv.category] || 0) + parseFloat(inv.currentAmount));
    return acc;
  }, {});
  return {
    isEmpty: !investments.length && !assets.length && !liabilities.length,
    totalValue,
    totalAssets,
    totalLiabilities,
    netWorth: round2(totalValue + totalAssets - totalLiabilities),
    categoryBreakdown,
    investments: investments.map(inv => ({
      id: inv.id,
      name: inv.name,
      category: inv.category,
      subCategory: inv.subCategory,
      amount: inv.currentAmount,
      institutionName: inv.institutionName,
    })),
  };
};

const createSnapshot = async (userId, snapshotDate, { isManual = false, notes } = {}) => {
  const data = await buildSnapshot(userId);
  delete data.isEmpty;
  return PortfolioSnapshot.create({ userId, snapshotDate, ...data, notes, isManual });
};

// One automatic snapshot per user per day; users with nothing tracked are skipped
const runDailySnapshots = async (date = today()) => {
  const users = await User.findAll({ attributes: ['id'], raw: true });
  let created = 0;
  for (const { id } of users) {
    if (await PortfolioSnapshot.count({ where: { userId: id, snapshotDate: date } })) continue;
    try {
      const { isEmpty, ...data } = await buildSnapshot(id);
      if (isEmpty) continue;
      await PortfolioSnapshot.create({ userId: id, snapshotDate: date, ...data, isManual: false });
      created += 1;
    } catch (error) {
      if (error.name !== 'SequelizeUniqueConstraintError') {
        logger.error({ err: error, userId: id }, 'Automatic snapshot failed');
      }
    }
  }
  return created;
};

const startSnapshotScheduler = () => {
  if (process.env.AUTO_SNAPSHOTS === 'false') return null;
  const run = () => runDailySnapshots()
    .then(created => created && logger.info({ created }, 'Automatic snapshots taken'))
    .catch(err => logger.error({ err }, 'Automatic snapshots failed'));
  run();
  const timer = setInterval(run, SCHEDULE_MS);
  timer.unref();
  return timer;
};

module.exports = { buildSnapshot, createSnapshot, runDailySnapshots, startSnapshotScheduler };
