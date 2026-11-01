const USER_TABLES = ['investments', 'assets', 'liabilities', 'goals', 'incomes', 'budget_categories'];
const MONEY_COLUMNS = [['budget_entries', 'budgeted_amount'], ['budget_entries', 'spent_amount'], ['goals', 'target_amount'], ['goals', 'current_amount'], ['goals', 'monthly_contribution'], ['incomes', 'amount']];

module.exports = {
  async up({ context: queryInterface }) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const run = (sql) => sequelize.query(sql, { transaction });

      await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_otp_attempts integer NOT NULL DEFAULT 0');

      // Keep the most recent row before adding uniqueness
      await run(`DELETE FROM portfolio_snapshots a USING portfolio_snapshots b
        WHERE a.user_id = b.user_id AND a.snapshot_date = b.snapshot_date
          AND (a.updated_at, a.id) < (b.updated_at, b.id)`);
      await run('CREATE UNIQUE INDEX IF NOT EXISTS portfolio_snapshots_user_id_snapshot_date ON portfolio_snapshots (user_id, snapshot_date)');

      await run(`DELETE FROM budget_entries a USING budget_entries b
        WHERE a.user_id = b.user_id AND a.category_id = b.category_id AND a.month = b.month
          AND (a.updated_at, a.id) < (b.updated_at, b.id)`);
      await run('CREATE UNIQUE INDEX IF NOT EXISTS budget_entries_user_id_category_id_month ON budget_entries (user_id, category_id, month)');

      for (const table of USER_TABLES) {
        await run(`CREATE INDEX IF NOT EXISTS ${table}_user_id ON ${table} (user_id)`);
      }

      for (const [table, column] of MONEY_COLUMNS) {
        await run(`ALTER TABLE ${table} ALTER COLUMN ${column} TYPE numeric(15,2)`);
      }
    });
  },

  async down({ context: queryInterface }) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const run = (sql) => sequelize.query(sql, { transaction });
      for (const [table, column] of MONEY_COLUMNS) {
        await run(`ALTER TABLE ${table} ALTER COLUMN ${column} TYPE numeric(12,2)`);
      }
      for (const table of USER_TABLES) await run(`DROP INDEX IF EXISTS ${table}_user_id`);
      await run('DROP INDEX IF EXISTS budget_entries_user_id_category_id_month');
      await run('DROP INDEX IF EXISTS portfolio_snapshots_user_id_snapshot_date');
      await run('ALTER TABLE users DROP COLUMN IF EXISTS email_otp_attempts');
    });
  },
};
