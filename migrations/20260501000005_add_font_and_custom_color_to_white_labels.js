exports.up = async function up(knex) {
  await knex.schema.alterTable('white_labels', (table) => {
    table.string('font_family', 50).nullable();
    table.string('custom_color', 20).nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('white_labels', (table) => {
    table.dropColumn('font_family');
    table.dropColumn('custom_color');
  });
};
