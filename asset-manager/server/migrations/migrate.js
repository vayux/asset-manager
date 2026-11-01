// Usage: npm run migrate -- up | down | pending | executed
require('dotenv').config();
const { umzug } = require('./index');

umzug.runAsCLI();
