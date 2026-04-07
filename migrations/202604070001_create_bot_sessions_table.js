exports.up = async function up(knex) {
  await knex.schema.createTable('bot_sessions', (table) => {
    table.string('phone', 32).primary();
    table.string('stage', 80).notNullable().defaultTo('START');
    table.text('payload_json').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('bot_sessions');
};
