const path = require('path');
require('dotenv').config();

function buildConnectionStringFromParts() {
  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT || '5432';
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DB;

  if (!host || !user || !password || !database) {
    return undefined;
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const encodedDatabase = encodeURIComponent(database);

  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${encodedDatabase}`;
}

function buildConnection() {
  const connectionString = process.env.DATABASE_URL || buildConnectionStringFromParts();
  if (!connectionString) {
    return undefined;
  }

  const sslMode = String(process.env.DB_SSL_MODE || '').toLowerCase();
  const useSslFromMode = sslMode && sslMode !== 'disable' && sslMode !== 'false';
  const useSsl = useSslFromMode || String(process.env.DB_SSL || 'false').toLowerCase() === 'true';

  return {
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false
  };
}

const dbClient = process.env.DB_DRIVER === 'postgres' ? 'pg' : 'pg';

module.exports = {
  development: {
    client: dbClient,
    connection: buildConnection(),
    migrations: {
      directory: path.resolve(__dirname, 'migrations'),
      tableName: 'knex_migrations'
    }
  }
};
