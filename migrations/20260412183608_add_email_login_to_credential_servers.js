exports.up = async function up(knex) {
  await knex.schema.alterTable('credential_servers', (table) => {
    table.string('email', 180).nullable();
    table.string('login', 180).nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('credential_servers', (table) => {
    table.dropColumn('email');
    table.dropColumn('login');
  });
};
