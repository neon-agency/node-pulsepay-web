exports.up = async function up(knex) {
  await knex.schema.alterTable('credential_servers', (table) => {
    table.dropForeign('server_id');
  });

  await knex.schema.alterTable('credential_servers', (table) => {
    table
      .foreign('server_id')
      .references('id')
      .inTable('servers')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('credential_servers', (table) => {
    table.dropForeign('server_id');
  });

  await knex.schema.alterTable('credential_servers', (table) => {
    table
      .foreign('server_id')
      .references('id')
      .inTable('servers')
      .onUpdate('CASCADE')
      .onDelete('RESTRICT');
  });
};
