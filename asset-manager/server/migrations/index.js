const { Umzug, SequelizeStorage } = require('umzug');
const { sequelize } = require('../config/database');

const umzug = new Umzug({
  migrations: { glob: ['[0-9][0-9][0-9][0-9]_*.js', { cwd: __dirname }] },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize, tableName: 'schema_migrations' }),
  logger: process.env.NODE_ENV === 'test' ? undefined : console,
});

const runMigrations = () => umzug.up();

module.exports = { umzug, runMigrations };
