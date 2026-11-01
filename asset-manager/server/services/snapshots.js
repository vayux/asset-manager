const { Investment, Asset, Liability, PortfolioSnapshot, User } = require('../models');
const logger = require('../utils/logger');
const { bookValue } = require('../utils/depreciation');
const { sumMoney } = require('../utils/money');
const { today } = require('../utils/dates');

const SCHEDULE_MS = 6 * 60 * 60 * 1000;

const buildSnapshot = async (userId) => {
  const [investments, assets, liabilities] = await Promise.all([
    Investment.findAll({ where: { userId, isActive: true } }),
    Asset.findAll({ where: { userId, isActive: true } }),
    Liability.findAll({ where: { userId, isActive: true } }),
  ]);
  const totalValue = sumMoney(investments, inv => inv.currentAmount);
  const totalAssets = sumMoney(assets, asset => bookValue(asset));
  const totalLiabilities = sumMoney(liabilities, l => l.outstandingAmount);
  const categoryBreakdown = investments.reduce((acc, inv) => {
    acc[inv.category] = sumMoney([acc[inv.category], inv.currentAmount]);
    return acc;
  }, {});
  return {
    isEmpty: !investments.length && !assets.length && !liabilities.length,
    totalValue,
    totalAssets,
    totalLiabilities,
    netWorth: sumMoney([totalValue, totalAssets, -totalLiabilities]),
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
