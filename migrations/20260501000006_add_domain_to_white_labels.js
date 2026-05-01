exports.up = async function up(knex) {
  await knex.schema.alterTable('white_labels', (table) => {
    table.string('domain', 255).nullable().unique();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('white_labels', (table) => {
    table.dropColumn('domain');
  });
};
