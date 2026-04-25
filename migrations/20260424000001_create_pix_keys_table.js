exports.up = async function up(knex) {
  await knex.schema.createTable('pix_keys', (table) => {
    table.string('id', 64).primary();
    table.string('user_id', 64).notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('tipo', 32).notNullable();
    table.string('chave', 255).notNullable();
    table.string('nome_titular', 160).notNullable();
    table.boolean('is_default').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index(['user_id']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('pix_keys');
};
