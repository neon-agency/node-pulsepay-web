exports.up = async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('admin_id', 64).nullable().references('id').inTable('users');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('admin_id');
  });
};
