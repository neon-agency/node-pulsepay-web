exports.up = async function up(knex) {
  await knex.schema.createTable('recharge_request_notifications', (table) => {
    table.string('id', 64).primary();
    table.string('recharge_request_id', 64).notNullable();
    table.string('recipient_user_id', 64).notNullable();
    table.string('event_type', 60).notNullable();
    table
      .enu('delivery_status', ['pending', 'sent', 'failed'])
      .notNullable()
      .defaultTo('pending');
    table.integer('attempts').notNullable().defaultTo(0);
    table.timestamp('sent_at').nullable();
    table.text('error_message').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table
      .foreign('recharge_request_id')
      .references('id')
      .inTable('recharge_requests')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table
      .foreign('recipient_user_id')
      .references('id')
      .inTable('users')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table.unique(['recharge_request_id', 'recipient_user_id', 'event_type']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('recharge_request_notifications');
};
