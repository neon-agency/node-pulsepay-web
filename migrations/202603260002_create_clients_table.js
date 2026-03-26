exports.up = async function up(knex) {
  await knex.schema.createTable('clients', (table) => {
    table.string('id', 64).primary();
    table.string('nome', 160).notNullable();
    table.string('email', 200).notNullable().unique();
    table.string('servidor_id', 64).notNullable();
    table.string('plano', 120).notNullable();
    table.enu('status', ['ativo', 'inativo', 'suspenso']).notNullable();
    table.date('vencimento').notNullable();
    table.enu('status_vencimento', ['critico', 'atencao', 'ok']).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table
      .foreign('servidor_id')
      .references('id')
      .inTable('servers')
      .onUpdate('CASCADE')
      .onDelete('RESTRICT');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('clients');
};
