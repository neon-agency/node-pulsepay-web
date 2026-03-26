exports.up = async function up(knex) {
  await knex.schema.createTable('credential_servers', (table) => {
    table.string('id', 64).primary();
    table.string('credential_id', 64).notNullable();
    table.string('server_id', 64).notNullable();
    table.decimal('price_override', 10, 2).nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['credential_id', 'server_id']);

    table
      .foreign('credential_id')
      .references('id')
      .inTable('credentials')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');

    table
      .foreign('server_id')
      .references('id')
      .inTable('servers')
      .onUpdate('CASCADE')
      .onDelete('RESTRICT');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('credential_servers');
};
