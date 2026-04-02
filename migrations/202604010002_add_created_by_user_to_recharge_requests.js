exports.up = async function up(knex) {
  await knex.schema.alterTable('recharge_requests', (table) => {
    table.string('created_by_user_id', 64).nullable();
    table
      .foreign('created_by_user_id')
      .references('id')
      .inTable('users')
      .onUpdate('CASCADE')
      .onDelete('SET NULL');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('recharge_requests', (table) => {
    table.dropForeign(['created_by_user_id']);
    table.dropColumn('created_by_user_id');
  });
};
