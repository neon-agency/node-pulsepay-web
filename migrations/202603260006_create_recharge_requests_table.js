exports.up = async function up(knex) {
  await knex.schema.createTable('recharge_requests', (table) => {
    table.string('id', 64).primary();
    table.string('credential_id', 64).notNullable();
    table.string('server_id', 64).notNullable();
    table.string('account_login', 160).notNullable();
    table.integer('quantity').notNullable();
    table.decimal('unit_price', 10, 2).notNullable();
    table.decimal('total_amount', 10, 2).notNullable();
    table.enu('payment_method', ['pix', 'cripto']).notNullable().defaultTo('pix');
    table
      .enu('payment_status', ['pendente_pagamento', 'pix_gerado', 'pago', 'cancelado'])
      .notNullable()
      .defaultTo('pendente_pagamento');
    table.text('pix_code').nullable();
    table.string('pix_txid', 120).nullable();
    table.string('requested_by_phone', 30).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table
      .foreign('credential_id')
      .references('id')
      .inTable('credentials')
      .onUpdate('CASCADE')
      .onDelete('RESTRICT');

    table
      .foreign('server_id')
      .references('id')
      .inTable('servers')
      .onUpdate('CASCADE')
      .onDelete('RESTRICT');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('recharge_requests');
};
