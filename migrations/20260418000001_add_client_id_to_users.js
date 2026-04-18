exports.up = async function up(knex) {
  await knex.schema.table('users', (table) => {
    table.string('client_id', 64).nullable().references('id').inTable('clients').onDelete('SET NULL');
  });
};

exports.down = async function down(knex) {
  await knex.schema.table('users', (table) => {
    table.dropColumn('client_id');
  });
};
