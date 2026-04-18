exports.up = async function up(knex) {
  await knex.schema.alterTable('servers', (table) => {
    table.jsonb('price_tiers').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('servers', (table) => {
    table.dropColumn('price_tiers');
  });
};
