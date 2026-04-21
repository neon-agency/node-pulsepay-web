exports.up = async function up(knex) {
  await knex.schema.alterTable('recharge_request_payment_proofs', (table) => {
    table.text('file_content_base64').nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('recharge_request_payment_proofs', (table) => {
    table.dropColumn('file_content_base64');
  });
};
