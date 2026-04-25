exports.up = async function up(knex) {
  await knex.schema.alterTable('credential_servers', (table) => {
    table
      .string('pix_key_id', 64)
      .nullable()
      .references('id')
      .inTable('pix_keys')
      .onDelete('SET NULL');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('credential_servers', (table) => {
    table.dropColumn('pix_key_id');
  });
};
