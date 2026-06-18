exports.up = async function up(knex) {
  await knex.schema.createTable('push_subscriptions', (table) => {
    table.string('id', 64).primary();
    table
      .string('user_id', 64)
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.text('endpoint').notNullable();
    table.text('p256dh').notNullable();
    table.text('auth').notNullable();
    table.string('user_agent', 255).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['endpoint']);
    table.index(['user_id']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('push_subscriptions');
};
