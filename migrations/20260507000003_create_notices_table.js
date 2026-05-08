exports.up = async function up(knex) {
  await knex.schema.createTable('notices', (table) => {
    table.string('id', 64).primary();
    table.string('title', 200).notNullable();
    table.text('text').notNullable().defaultTo('');
    table.text('banner_url').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('starts_at', { useTz: true }).nullable();
    table.timestamp('ends_at', { useTz: true }).nullable();
    table.string('created_by_user_id', 64).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_notices_active_window ON notices (is_active, starts_at, ends_at)'
  );
};

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_notices_active_window');
  await knex.schema.dropTableIfExists('notices');
};
