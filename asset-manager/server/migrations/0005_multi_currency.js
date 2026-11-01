module.exports = {
  async up({ context: queryInterface }) {
    await queryInterface.sequelize.query(`
      ALTER TABLE investments ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'INR';
      ALTER TABLE assets ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'INR';
      ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'INR';
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        currency varchar(3) NOT NULL,
        rate_to_inr numeric(18,6) NOT NULL CHECK (rate_to_inr > 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT exchange_rates_user_id_currency UNIQUE (user_id, currency)
      );
    `);
  },

  async down({ context: queryInterface }) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS exchange_rates;
      ALTER TABLE investments DROP COLUMN IF EXISTS currency;
      ALTER TABLE assets DROP COLUMN IF EXISTS currency;
      ALTER TABLE liabilities DROP COLUMN IF EXISTS currency;
    `);
  },
};
