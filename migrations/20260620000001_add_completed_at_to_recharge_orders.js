exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE recharge_orders ADD COLUMN IF NOT EXISTS completed_at timestamp NULL;

    UPDATE recharge_orders
       SET completed_at = updated_at
     WHERE status = 'CONCLUIDO'
       AND completed_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_recharge_orders_completed_at
      ON recharge_orders (completed_at DESC)
      WHERE completed_at IS NOT NULL;
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_recharge_orders_completed_at;
    ALTER TABLE recharge_orders DROP COLUMN IF EXISTS completed_at;
  `);
};
