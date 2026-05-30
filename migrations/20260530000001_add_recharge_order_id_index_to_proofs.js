exports.up = async function up(knex) {
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_proofs_recharge_order_id
    ON recharge_request_payment_proofs (recharge_order_id)
  `);
};

exports.down = async function down(knex) {
  await knex.schema.raw(`
    DROP INDEX IF EXISTS idx_proofs_recharge_order_id
  `);
};
