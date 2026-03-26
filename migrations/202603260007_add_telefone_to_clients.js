exports.up = async function up(knex) {
  await knex.schema.alterTable('clients', (table) => {
    table.string('telefone', 32).nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('clients', (table) => {
    table.dropColumn('telefone');
  });
};
