// Config de loja por-admin: status aberto/fechado (switch manual do master) +
// horário/dias informativos exibidos ao revenda. Espelha o padrão de white_labels.
exports.up = async function up(knex) {
  await knex.schema.createTable('store_settings', (table) => {
    table.string('id', 64).primary();
    table
      .string('admin_id', 64)
      .notNullable()
      .unique()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.boolean('is_open').notNullable().defaultTo(true);
    table.string('opening_time', 5).nullable(); // HH:MM
    table.string('closing_time', 5).nullable(); // HH:MM
    table.jsonb('open_days').nullable(); // [0..6] 0=Dom
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('store_settings');
};
