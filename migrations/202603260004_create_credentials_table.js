exports.up = async function up(knex) {
  await knex.schema.createTable('credentials', (table) => {
    table.string('id', 64).primary();
    table.string('nome', 160).notNullable();
    table.string('last4', 4).notNullable();
    table.string('nome_normalized', 160).notNullable();
    table.string('credential_key', 200).notNullable().unique();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('credentials');
};
