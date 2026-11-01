const { sequelize } = require('../config/database');
const { runMigrations } = require('../migrations');

// Rebuild the test schema from migrations so tests exercise the same schema as production
const resetDatabase = async () => {
  await sequelize.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await runMigrations();
};

module.exports = { resetDatabase };
