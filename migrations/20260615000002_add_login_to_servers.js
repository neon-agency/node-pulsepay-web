// Login privado do servidor (username, opcional) — só o master vê. Usado para
// exibir, no painel do master, o login de acesso do servidor numa recarga.
exports.up = async function up(knex) {
  await knex.schema.alterTable('servers', (table) => {
    table.string('login', 180).nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('servers', (table) => {
    table.dropColumn('login');
  });
};
