/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.table('servers', (table) => {
    table.decimal('custo_credito', 10, 2).notNullable().defaultTo(0);
    table.integer('estoque').notNullable().defaultTo(0);
    table.integer('estoque_alerta').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.table('servers', (table) => {
    table.dropColumn('custo_credito');
    table.dropColumn('estoque');
    table.dropColumn('estoque_alerta');
  });
};
