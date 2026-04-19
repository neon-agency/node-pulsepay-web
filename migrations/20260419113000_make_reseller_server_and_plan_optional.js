/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('clients', (table) => {
    table.string('servidor_id', 64).nullable().alter();
    table.string('plano', 120).nullable().alter();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  await knex('clients')
    .where({ tipo: 'revenda' })
    .whereNull('plano')
    .update({ plano: 'Mensal' });

  await knex('clients')
    .where({ tipo: 'revenda' })
    .whereNull('servidor_id')
    .update({ servidor_id: knex.raw("(select id from servers order by created_at asc limit 1)") });

  await knex.schema.alterTable('clients', (table) => {
    table.string('servidor_id', 64).notNullable().alter();
    table.string('plano', 120).notNullable().alter();
  });
};
