exports.up = async function up(knex) {
  await knex.schema.alterTable('recharge_requests', (table) => {
    table
      .string('order_id', 64)
      .nullable()
      .references('id')
      .inTable('recharge_orders')
      .onDelete('CASCADE');
    table.index(['order_id'], 'idx_recharge_requests_order_id');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('recharge_requests', (table) => {
    table.dropIndex(['order_id'], 'idx_recharge_requests_order_id');
    table.dropColumn('order_id');
  });
};
