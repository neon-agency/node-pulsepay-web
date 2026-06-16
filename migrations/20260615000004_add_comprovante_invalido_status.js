// Adiciona o status "comprovante_invalido" ao CHECK de payment_status
// (recharge_requests cobre os itens de pedido + recharge_orders).
const STATUSES_NEW = "'pendente_pagamento','pix_gerado','pago','sem_creditos','comprovante_invalido','cancelado'";
const STATUSES_OLD = "'pendente_pagamento','pix_gerado','pago','sem_creditos','cancelado'";

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
  await knex.raw(`
    ALTER TABLE recharge_requests DROP CONSTRAINT IF EXISTS recharge_requests_payment_status_check;
    ALTER TABLE recharge_requests ADD CONSTRAINT recharge_requests_payment_status_check
      CHECK (payment_status IN (${STATUSES_OLD}));
    ALTER TABLE recharge_orders DROP CONSTRAINT IF EXISTS recharge_orders_payment_status_check;
    ALTER TABLE recharge_orders ADD CONSTRAINT recharge_orders_payment_status_check
      CHECK (payment_status IN (${STATUSES_OLD}));
  `);
};
