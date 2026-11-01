module.exports = {
  async up({ context: queryInterface }) {
    await queryInterface.sequelize.query(`
      ALTER TABLE portfolio_snapshots
        ADD COLUMN IF NOT EXISTS total_assets numeric(15,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_liabilities numeric(15,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS net_worth numeric(15,2);
      UPDATE portfolio_snapshots SET net_worth = total_value WHERE net_worth IS NULL;
      ALTER TABLE portfolio_snapshots ALTER COLUMN net_worth SET DEFAULT 0, ALTER COLUMN net_worth SET NOT NULL;
    `);
  },

  async down({ context: queryInterface }) {
    await queryInterface.sequelize.query(`
      ALTER TABLE portfolio_snapshots
        DROP COLUMN IF EXISTS total_assets,
        DROP COLUMN IF EXISTS total_liabilities,
        DROP COLUMN IF EXISTS net_worth;
    `);
  },
};
