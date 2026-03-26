const knex = require('knex');
const config = require('../../knexfile');

const env = process.env.NODE_ENV || 'development';
const knexConfig = config[env] || config.development;

if (!knexConfig.connection) {
  throw new Error('DATABASE_URL não configurada. Defina no .env para usar PostgreSQL.');
}

module.exports = knex(knexConfig);
