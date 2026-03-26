exports.up = async function up(knex) {
  await knex.schema.alterTable('servers', (table) => {
    table.decimal('base_price', 10, 2).notNullable().defaultTo(10);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('servers', (table) => {
    table.dropColumn('base_price');
  });
};
