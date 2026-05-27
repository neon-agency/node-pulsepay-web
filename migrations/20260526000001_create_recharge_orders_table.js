exports.up = async function up(knex) {
  await knex.schema.createTable('recharge_orders', (table) => {
    table.string('id', 64).primary();
    table
      .string('created_by_user_id', 64)
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table
      .string('client_id', 64)
      .nullable()
      .references('id')
      .inTable('clients')
      .onUpdate('CASCADE')
      .onDelete('SET NULL');
    table.enu('payment_method', ['pix', 'cripto']).notNullable().defaultTo('pix');
    table
      .enu('payment_status', ['pendente_pagamento', 'pix_gerado', 'pago', 'cancelado'])
      .notNullable()
      .defaultTo('pendente_pagamento');
    table.decimal('total_amount', 12, 2).notNullable();
    table.integer('item_count').notNullable();
    table.text('pix_code').nullable();
    table.string('pix_txid', 120).nullable();
    table
      .string('pix_key_id', 64)
      .nullable()
      .references('id')
      .inTable('pix_keys')
      .onDelete('SET NULL');
    table.string('requested_by_phone', 30).nullable();
    table.boolean('archived').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.index(['client_id', 'created_at', 'id'], 'idx_recharge_orders_client_created');
    table.index(['payment_status'], 'idx_recharge_orders_status');
    table.index(['archived'], 'idx_recharge_orders_archived');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('recharge_orders');
};
