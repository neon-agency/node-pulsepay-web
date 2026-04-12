exports.up = async function up(knex) {
  await knex.schema.alterTable('servers', (table) => {
    table.string('url', 512).nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('servers', (table) => {
    table.dropColumn('url');
  });
};
