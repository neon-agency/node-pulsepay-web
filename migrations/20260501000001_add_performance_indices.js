/**
 * Indices to speed up dashboard summary, ranking and reseller-scoped queries.
 *
 * Hot-path filters / joins covered:
 *  - WHERE payment_status = 'pago' (summary, finances, rankings)
 *  - WHERE updated_at >= cutoff (rankings + finances period filter)
 *  - WHERE created_at >= cutoff (summary period filter, "recargas do dia")
 *  - JOIN ON recharge_requests.credential_id / server_id (list, ranking, summary)
 *  - JOIN payment_proofs.recharge_request_id (latest proof lookup)
 *  - WHERE clients.tipo = 'revenda' (reseller list)
 *  - JOIN credential_servers.server_id WHERE is_active (reseller count subquery)
 *  - JOIN credentials.client_id (reseller credential filter)
 */
exports.up = async function up(knex) {
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_recharge_requests_payment_status_updated_at
      ON recharge_requests (payment_status, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_recharge_requests_created_at
      ON recharge_requests (created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_recharge_requests_credential_id
      ON recharge_requests (credential_id);

    CREATE INDEX IF NOT EXISTS idx_recharge_requests_server_id
      ON recharge_requests (server_id);

    CREATE INDEX IF NOT EXISTS idx_recharge_request_payment_proofs_recharge_request_created
      ON recharge_request_payment_proofs (recharge_request_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_clients_tipo
      ON clients (tipo);

    CREATE INDEX IF NOT EXISTS idx_credential_servers_server_active
      ON credential_servers (server_id, is_active);

    CREATE INDEX IF NOT EXISTS idx_credential_servers_credential_id
      ON credential_servers (credential_id);

    CREATE INDEX IF NOT EXISTS idx_credentials_client_id
      ON credentials (client_id);

    CREATE INDEX IF NOT EXISTS idx_pix_keys_user_default
      ON pix_keys (user_id, is_default DESC);
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_recharge_requests_payment_status_updated_at;
    DROP INDEX IF EXISTS idx_recharge_requests_created_at;
    DROP INDEX IF EXISTS idx_recharge_requests_credential_id;
    DROP INDEX IF EXISTS idx_recharge_requests_server_id;
    DROP INDEX IF EXISTS idx_recharge_request_payment_proofs_recharge_request_created;
    DROP INDEX IF EXISTS idx_clients_tipo;
    DROP INDEX IF EXISTS idx_credential_servers_server_active;
    DROP INDEX IF EXISTS idx_credential_servers_credential_id;
    DROP INDEX IF EXISTS idx_credentials_client_id;
    DROP INDEX IF EXISTS idx_pix_keys_user_default;
  `);
};
