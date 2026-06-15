// Adiciona o status "sem_creditos" ao CHECK de payment_status nas tabelas
// recharge_requests (cobre tambem os itens de pedido, que sao linhas nesta tabela)
// e recharge_orders. knex .enu() cria coluna varchar + CHECK constraint nomeada
// <tabela>_payment_status_check (nao e enum nativo do Postgres).
const STATUSES_NEW = "'pendente_pagamento','pix_gerado','pago','sem_creditos','cancelado'";
const STATUSES_OLD = "'pendente_pagamento','pix_gerado','pago','cancelado'";

exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE recharge_requests DROP CONSTRAINT IF EXISTS recharge_requests_payment_status_check;
    ALTER TABLE recharge_requests ADD CONSTRAINT recharge_requests_payment_status_check
      CHECK (payment_status IN (${STATUSES_NEW}));
    ALTER TABLE recharge_orders DROP CONSTRAINT IF EXISTS recharge_orders_payment_status_check;
    ALTER TABLE recharge_orders ADD CONSTRAINT recharge_orders_payment_status_check
      CHECK (payment_status IN (${STATUSES_NEW}));
  `);
};

exports.down = async function down(knex) {
  // Reverte para o conjunto antigo. Falha se ainda existirem linhas com
  // payment_status = 'sem_creditos' (esperado — limpe antes de reverter).
  await knex.raw(`
    ALTER TABLE recharge_requests DROP CONSTRAINT IF EXISTS recharge_requests_payment_status_check;
    ALTER TABLE recharge_requests ADD CONSTRAINT recharge_requests_payment_status_check
      CHECK (payment_status IN (${STATUSES_OLD}));
    ALTER TABLE recharge_orders DROP CONSTRAINT IF EXISTS recharge_orders_payment_status_check;
    ALTER TABLE recharge_orders ADD CONSTRAINT recharge_orders_payment_status_check
      CHECK (payment_status IN (${STATUSES_OLD}));
  `);
};
