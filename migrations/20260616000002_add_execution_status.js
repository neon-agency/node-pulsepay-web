// Item de pedido vira apenas marcador de execucao (toggle). A nova coluna
// `execution_status` (NAO_REALIZADO / REALIZADO) so e relevante para linhas que
// sao itens de pedido (order_id IS NOT NULL). Solicitacoes avulsas (order_id
// NULL) ficam sempre 'NAO_REALIZADO' e nao usam esta coluna.
const STATUSES = "'NAO_REALIZADO','REALIZADO'";

exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE recharge_requests ADD COLUMN IF NOT EXISTS execution_status varchar(16) NOT NULL DEFAULT 'NAO_REALIZADO';
    ALTER TABLE recharge_requests DROP CONSTRAINT IF EXISTS recharge_requests_execution_status_check;
    ALTER TABLE recharge_requests ADD CONSTRAINT recharge_requests_execution_status_check
      CHECK (execution_status IN (${STATUSES}));
    UPDATE recharge_requests SET execution_status = CASE
      WHEN order_id IS NOT NULL AND payment_status = 'pago' THEN 'REALIZADO'
      ELSE 'NAO_REALIZADO'
    END;
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    ALTER TABLE recharge_requests DROP CONSTRAINT IF EXISTS recharge_requests_execution_status_check;
    ALTER TABLE recharge_requests DROP COLUMN IF EXISTS execution_status;
  `);
};
