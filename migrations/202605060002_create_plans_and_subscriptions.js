exports.up = async function up(knex) {
  await knex.schema.createTable('plans', (table) => {
    table.string('id', 64).primary();
    table.string('name', 120).notNullable();
    table.integer('price_cents').notNullable();
    table.string('currency', 8).notNullable().defaultTo('BRL');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('user_subscriptions', (table) => {
    table.string('id', 64).primary();
    table.string('user_id', 64).notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.string('plan_id', 64).notNullable()
      .references('id')
      .inTable('plans')
      .onDelete('RESTRICT');
    table.string('status', 32).notNullable().defaultTo('pending');
    table.string('payment_provider', 32).nullable();
    table.string('payment_provider_id', 128).nullable();
    table.text('payment_json').nullable();
    table.timestamp('activated_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('user_subscriptions', (table) => {
    table.index(['user_id', 'created_at'], 'idx_user_subscriptions_user_created');
    table.index(['status'], 'idx_user_subscriptions_status');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('user_subscriptions');
  await knex.schema.dropTableIfExists('plans');
};

