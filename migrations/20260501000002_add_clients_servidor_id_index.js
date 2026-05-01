/**
 * Index on clients.servidor_id for the COUNT(*) per-server subquery used by
 * servers.findAll (clientCount aggregate).
 */
exports.up = async function up(knex) {
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_clients_servidor_id ON clients (servidor_id);');
};

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_clients_servidor_id;');
};
