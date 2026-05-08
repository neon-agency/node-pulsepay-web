exports.up = async function up(knex) {
  await knex.schema.alterTable('recharge_requests', (table) => {
    table.boolean('is_promo').notNullable().defaultTo(false);
    table.decimal('promo_unit_price', 10, 2).nullable();
    table.decimal('catalog_unit_price', 10, 2).nullable();
  });

  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_recharge_requests_is_promo ON recharge_requests (is_promo) WHERE is_promo = true'
  );
};

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_recharge_requests_is_promo');
  await knex.schema.alterTable('recharge_requests', (table) => {
    table.dropColumn('is_promo');
    table.dropColumn('promo_unit_price');
    table.dropColumn('catalog_unit_price');
  });
};
