exports.up = async function up(knex) {
  await knex.schema.alterTable('invites', (table) => {
    table.string('name', 160).nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('invites', (table) => {
    table.dropColumn('name');
  });
};
