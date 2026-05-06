exports.up = async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('welcome_password', 255).nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('welcome_password');
  });
};
