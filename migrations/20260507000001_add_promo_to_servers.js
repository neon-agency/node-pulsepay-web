exports.up = async function up(knex) {
  await knex.schema.alterTable('servers', (table) => {
    table.jsonb('promo_price_tiers').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
    table.boolean('promo_active').notNullable().defaultTo(false);
    table.timestamp('promo_expires_at', { useTz: true }).nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('servers', (table) => {
    table.dropColumn('promo_price_tiers');
    table.dropColumn('promo_active');
    table.dropColumn('promo_expires_at');
  });
};
