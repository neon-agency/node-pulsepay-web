exports.up = async function up(knex) {
  await knex.schema.alterTable('white_labels', (table) => {
    table.text('logo_url').alter();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('white_labels', (table) => {
    table.string('logo_url', 500).alter();
  });
};
