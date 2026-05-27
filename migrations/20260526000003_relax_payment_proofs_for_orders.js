exports.up = async function up(knex) {
  await knex.schema.alterTable('recharge_request_payment_proofs', (table) => {
    table
      .string('recharge_order_id', 64)
      .nullable()
      .references('id')
      .inTable('recharge_orders')
      .onDelete('CASCADE');
  });

  await knex.raw('ALTER TABLE recharge_request_payment_proofs ALTER COLUMN recharge_request_id DROP NOT NULL');
  await knex.raw('ALTER TABLE recharge_request_payment_proofs ALTER COLUMN sender_phone DROP NOT NULL');

  await knex.raw(`
    ALTER TABLE recharge_request_payment_proofs
    ADD CONSTRAINT chk_proof_target_exclusive
    CHECK (
      (recharge_request_id IS NOT NULL AND recharge_order_id IS NULL)
      OR (recharge_request_id IS NULL AND recharge_order_id IS NOT NULL)
    )
  `);

  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_rr_payment_proofs_order_created ON recharge_request_payment_proofs (recharge_order_id, created_at)'
  );
};

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_rr_payment_proofs_order_created');
  await knex.raw('ALTER TABLE recharge_request_payment_proofs DROP CONSTRAINT IF EXISTS chk_proof_target_exclusive');
  await knex.raw("UPDATE recharge_request_payment_proofs SET sender_phone = '' WHERE sender_phone IS NULL");
  await knex.raw('ALTER TABLE recharge_request_payment_proofs ALTER COLUMN sender_phone SET NOT NULL');
  await knex.raw('DELETE FROM recharge_request_payment_proofs WHERE recharge_request_id IS NULL');
  await knex.raw('ALTER TABLE recharge_request_payment_proofs ALTER COLUMN recharge_request_id SET NOT NULL');
  await knex.schema.alterTable('recharge_request_payment_proofs', (table) => {
    table.dropColumn('recharge_order_id');
  });
};
