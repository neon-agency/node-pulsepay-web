exports.up = async function up(knex) {
  await knex.schema.alterTable('credential_servers', (table) => {
    table.jsonb('price_tiers_override').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('credential_servers', (table) => {
    table.dropColumn('price_tiers_override');
  });
};
