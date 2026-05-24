exports.up = async function up(knex) {
  await knex.schema.alterTable('invites', (table) => {
    table.dropColumn('used_at');
    table.dropColumn('used_by_user_id');
    table.dropColumn('used_by_client_id');
  });

  await knex.schema.alterTable('invites', (table) => {
    table.integer('usage_count').notNullable().defaultTo(0);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('invites', (table) => {
    table.dropColumn('usage_count');
  });

  await knex.schema.alterTable('invites', (table) => {
    table.timestamp('used_at', { useTz: true }).nullable();
    table.string('used_by_user_id', 64).nullable();
    table.string('used_by_client_id', 64).nullable();

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
};
