exports.up = async function up(knex) {
  await knex.schema.createTable('servers', (table) => {
    table.string('id', 64).primary();
    table.string('servidor', 120).notNullable().unique();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('servers');
};
