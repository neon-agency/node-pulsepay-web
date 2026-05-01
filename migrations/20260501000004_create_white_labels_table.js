exports.up = async function up(knex) {
  await knex.schema.createTable('white_labels', (table) => {
    table.string('id', 64).primary();
    table.string('user_id', 64).notNullable().unique().references('id').inTable('users');
    table.string('system_name', 160).nullable();
    table.string('logo_url', 500).nullable();
    table.string('color_scheme', 50).notNullable().defaultTo('default');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('white_labels');
};
