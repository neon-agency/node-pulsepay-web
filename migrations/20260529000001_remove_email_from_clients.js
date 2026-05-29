exports.up = async function up(knex) {
  await knex.schema.alterTable('clients', (table) => {
    table.dropColumn('email');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('clients', (table) => {
    table.string('email', 200).nullable();
  });
};
