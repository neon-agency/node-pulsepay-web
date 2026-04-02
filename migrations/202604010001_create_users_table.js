exports.up = async function up(knex) {
  await knex.schema.createTable('users', (table) => {
    table.string('id', 64).primary();
    table.string('name', 160).notNullable();
    table.string('email', 160).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('role', 60).notNullable().defaultTo('admin');
    table.string('whatsapp_phone', 20).nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('users');
};
