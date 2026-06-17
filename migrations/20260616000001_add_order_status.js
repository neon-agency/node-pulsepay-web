// Refatoracao do fluxo de pedidos: PIX + comprovante sao pre-requisito de
// entrada, nao estado. O pedido passa a ter uma maquina de estado propria
// (SOLICITADO / EM_ESPERA / CONCLUIDO / CANCELADO) na nova coluna `status`,
// independente de `payment_status` (mantida por compatibilidade/rollback).
const STATUSES = "'SOLICITADO','EM_ESPERA','CONCLUIDO','CANCELADO'";

exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE recharge_orders ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'SOLICITADO';
    ALTER TABLE recharge_orders DROP CONSTRAINT IF EXISTS recharge_orders_status_check;
    ALTER TABLE recharge_orders ADD CONSTRAINT recharge_orders_status_check
      CHECK (status IN (${STATUSES}));
    UPDATE recharge_orders SET status = CASE
      WHEN payment_status IN ('pix_gerado','pendente_pagamento') THEN 'SOLICITADO'
      WHEN payment_status = 'pago' THEN 'CONCLUIDO'
      WHEN payment_status = 'cancelado' THEN 'CANCELADO'
      WHEN payment_status IN ('sem_creditos','comprovante_invalido') THEN 'EM_ESPERA'
      ELSE 'SOLICITADO'
    END;
    CREATE INDEX IF NOT EXISTS idx_recharge_orders_status_v2 ON recharge_orders (status);
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_recharge_orders_status_v2;
    ALTER TABLE recharge_orders DROP CONSTRAINT IF EXISTS recharge_orders_status_check;
    ALTER TABLE recharge_orders DROP COLUMN IF EXISTS status;
  `);
};
