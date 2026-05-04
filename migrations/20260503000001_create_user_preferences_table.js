exports.up = async function up(knex) {
  await knex.schema.createTable('user_preferences', (table) => {
    table.string('id', 64).primary();
    table.string('user_id', 64).notNullable().unique().references('id').inTable('users').onDelete('CASCADE');
    table.string('theme', 16).notNullable().defaultTo('system');
    table.string('color_scheme', 50).nullable();
    table.string('custom_color', 16).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('user_preferences');
};
