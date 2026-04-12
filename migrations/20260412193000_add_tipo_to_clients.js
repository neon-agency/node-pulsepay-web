exports.up = async function up(knex) {
  await knex.schema.alterTable('clients', (table) => {
    table.string('tipo', 20).notNullable().defaultTo('cliente');
    table.index(['tipo'], 'clients_tipo_idx');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('clients', (table) => {
    table.dropIndex(['tipo'], 'clients_tipo_idx');
    table.dropColumn('tipo');
  });
};
