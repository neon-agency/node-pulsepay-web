exports.up = async function up(knex) {
  await knex.schema.alterTable('credentials', (table) => {
    table.dropUnique(['credential_key']);
  });

  await knex.schema.alterTable('credentials', (table) => {
    table
      .string('client_id', 64)
      .nullable()
      .references('id')
      .inTable('clients')
      .onUpdate('CASCADE')
      .onDelete('RESTRICT');
  });

  const orphanRows = await knex('credentials').whereNull('client_id').count('* as c');
  const orphanCount = Number(orphanRows[0]?.c ?? 0);

  if (orphanCount > 0) {
    const clients = await knex('clients').select('id').orderBy('created_at', 'asc');

    if (clients.length === 0) {
      throw new Error(
        'Migração 008: existem credenciais sem cliente, mas não há clientes cadastrados. Cadastre um cliente ou remova as credenciais antes de migrar.'
      );
    }

    if (clients.length > 1) {
      throw new Error(
        'Migração 008: credenciais antigas sem client_id. Com mais de um cliente, associe manualmente, por exemplo: UPDATE credentials SET client_id = \'SEU_CLIENT_ID\' WHERE client_id IS NULL; depois rode knex migrate:latest de novo.'
      );
    }

    await knex('credentials').whereNull('client_id').update({ client_id: clients[0].id });
  }

  await knex.raw('ALTER TABLE credentials ALTER COLUMN client_id SET NOT NULL');

  await knex.schema.alterTable('credentials', (table) => {
    table.unique(['client_id', 'credential_key']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('credentials', (table) => {
    table.dropUnique(['client_id', 'credential_key']);
  });

  await knex.schema.alterTable('credentials', (table) => {
    table.dropForeign(['client_id']);
    table.dropColumn('client_id');
  });

  await knex.schema.alterTable('credentials', (table) => {
    table.unique(['credential_key']);
  });
};
