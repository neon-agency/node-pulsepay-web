const db = require('../database/knex');

class CredentialServersRepository {
  mapRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      credentialId: row.credential_id,
      serverId: row.server_id,
      priceOverride: row.price_override === null ? null : Number(row.price_override),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  mapRowWithServer(row) {
    if (!row) return null;

    return {
      ...this.mapRow(row),
      servidor: row.servidor,
      basePrice: Number(row.base_price)
    };
  }

  async findByCredentialId(credentialId) {
    const rows = await db('credential_servers')
      .where({ credential_id: credentialId })
      .orderBy('created_at', 'desc');
    return rows.map((row) => this.mapRow(row));
  }

  async findByCredentialIdWithServers(credentialId) {
    const rows = await db('credential_servers as cs')
      .innerJoin('servers as s', 's.id', 'cs.server_id')
      .select('cs.*', 's.servidor', 's.base_price')
      .where({ 'cs.credential_id': credentialId })
      .orderBy('cs.created_at', 'desc');

    return rows.map((row) => this.mapRowWithServer(row));
  }

  async findOneByCredentialAndServer(credentialId, serverId) {
    const row = await db('credential_servers as cs')
      .innerJoin('servers as s', 's.id', 'cs.server_id')
      .select('cs.*', 's.servidor', 's.base_price')
      .where({
        'cs.credential_id': credentialId,
        'cs.server_id': serverId
      })
      .first();

    return this.mapRowWithServer(row);
  }

  async replaceAll(credentialId, links) {
    return db.transaction(async (trx) => {
      await trx('credential_servers').where({ credential_id: credentialId }).del();
      if (!links.length) return [];

      const payload = links.map((item) => ({
        ...item,
        credential_id: item.credentialId,
        server_id: item.serverId,
        price_override: item.priceOverride,
        is_active: item.isActive
      }));

      for (const item of payload) {
        delete item.credentialId;
        delete item.serverId;
        delete item.priceOverride;
        delete item.isActive;
      }

      await trx('credential_servers').insert(payload);

      const rows = await trx('credential_servers')
        .where({ credential_id: credentialId })
        .orderBy('created_at', 'desc');

      return rows.map((row) => this.mapRow(row));
    });
  }
}

module.exports = new CredentialServersRepository();
