const fs = require('fs');
const path = require('path');

const TABLES = [
  'liabilities', 'asset_valuations', 'assets', 'budget_entries', 'budget_categories', 'goals',
  'incomes', 'investment_histories', 'investments', 'portfolio_snapshots', 'users',
];
const TYPES = [
  'enum_assets_category', 'enum_budget_categories_framework_tag', 'enum_goals_scope',
  'enum_incomes_frequency', 'enum_investments_category', 'enum_liabilities_category',
];

// Schema as created by the original sequelize.sync(). Databases that already have it are left untouched.
module.exports = {
  async up({ context: queryInterface }) {
    const { sequelize } = queryInterface;
    const [[{ existing }]] = await sequelize.query("SELECT to_regclass('public.users') AS existing");
    if (existing) return;
    const sql = fs.readFileSync(path.join(__dirname, '0001_baseline.sql'), 'utf8');
    await sequelize.transaction((transaction) => sequelize.query(sql, { transaction }));
  },

  async down({ context: queryInterface }) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      for (const table of TABLES) await sequelize.query(`DROP TABLE IF EXISTS ${table} CASCADE`, { transaction });
      for (const type of TYPES) await sequelize.query(`DROP TYPE IF EXISTS ${type}`, { transaction });
    });
  },
};
