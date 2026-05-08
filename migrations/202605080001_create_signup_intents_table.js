exports.up = async function up(knex) {
  await knex.schema.createTable('signup_intents', (table) => {
    table.string('id', 64).primary();
    table.string('name', 160).notNullable();
    table.string('email', 160).notNullable();
    table.string('whatsapp_phone', 32).notNullable();
    table.string('password_hash', 255).notNullable();
    table.string('plan_id', 64).notNullable()
      .references('id')
      .inTable('plans')
      .onDelete('RESTRICT');
    table.string('status', 32).notNullable().defaultTo('pending_payment'); // pending_payment | paid | account_created | expired
    table.string('payment_provider', 32).nullable();
    table.string('payment_provider_id', 128).nullable();
    table.text('payment_json').nullable();
    table.timestamp('paid_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('signup_intents', (table) => {
    table.index(['email', 'created_at'], 'idx_signup_intents_email_created');
    table.index(['status'], 'idx_signup_intents_status');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('signup_intents');
};

