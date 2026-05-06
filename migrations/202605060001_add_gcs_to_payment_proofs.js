exports.up = async function up(knex) {
  await knex.schema.alterTable('recharge_request_payment_proofs', (table) => {
    table.string('file_storage_provider', 20).nullable();
    table.string('file_gcs_bucket', 128).nullable();
    table.text('file_gcs_object').nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('recharge_request_payment_proofs', (table) => {
    table.dropColumn('file_storage_provider');
    table.dropColumn('file_gcs_bucket');
    table.dropColumn('file_gcs_object');
  });
};

