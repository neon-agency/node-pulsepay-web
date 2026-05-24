exports.up = async function up(knex) {
  await knex.schema.createTable('invites', (table) => {
    table.string('id', 64).primary();
    table.string('token_hash', 64).notNullable().unique();
    table.string('token_preview', 12).notNullable();
    table.string('admin_id', 64).notNullable();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('used_at', { useTz: true }).nullable();
    table.string('used_by_user_id', 64).nullable();
    table.string('used_by_client_id', 64).nullable();
    table.timestamp('revoked_at', { useTz: true }).nullable();
    table.string('revoked_by_user_id', 64).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table
      .foreign('admin_id')
      .references('id')
      .inTable('users')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');

    table
      .foreign('used_by_user_id')
      .references('id')
      .inTable('users')
      .onUpdate('CASCADE')
      .onDelete('SET NULL');

    table
      .foreign('used_by_client_id')
      .references('id')
      .inTable('clients')
      .onUpdate('CASCADE')
      .onDelete('SET NULL');
  });

  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_invites_admin_created ON invites (admin_id, created_at DESC)'
  );
};

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_invites_admin_created');
  await knex.schema.dropTableIfExists('invites');
};
