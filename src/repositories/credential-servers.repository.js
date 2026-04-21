const db = require('../database/knex');

class CredentialServersRepository {
  normalizePriceTiers(value) {
    const raw = Array.isArray(value) ? value : [];
    return raw
      .map((tier) => ({
        quantity: Number(tier?.quantity ?? 0),
        unitPrice: Number(tier?.unitPrice ?? tier?.unit_price ?? 0)
      }))
      .filter((tier) => Number.isFinite(tier.quantity) && tier.quantity > 0 && Number.isFinite(tier.unitPrice) && tier.unitPrice > 0)
      .sort((a, b) => a.quantity - b.quantity);
  }

  mapRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      credentialId: row.credential_id,
      serverId: row.server_id,
      priceOverride: row.price_override === null ? null : Number(row.price_override),
      priceTiersOverride: this.normalizePriceTiers(row.price_tiers_override),
      isActive: Boolean(row.is_active),
      email: row.email ?? null,
      login: row.login ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  mapRowWithServer(row) {
    if (!row) return null;

    return {
      ...this.mapRow(row),
      servidor: row.servidor,
      basePrice: Number(row.base_price),
      serverPriceTiers: this.normalizePriceTiers(row.server_price_tiers)
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
      .select('cs.*', 's.servidor', 's.base_price', 's.price_tiers as server_price_tiers')
      .where({ 'cs.credential_id': credentialId })
      .orderBy('cs.created_at', 'desc');

    return rows.map((row) => this.mapRowWithServer(row));
  }

  async findActiveByEmailWithCredentialAndServer(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return [];

    return db('credential_servers as cs')
      .innerJoin('servers as s', 's.id', 'cs.server_id')
      .innerJoin('credentials as c', 'c.id', 'cs.credential_id')
      .select(
        'cs.*',
        's.servidor',
        's.base_price',
        's.price_tiers as server_price_tiers',
        'c.nome as credential_nome',
        'c.last4 as credential_last4',
        'c.client_id as credential_client_id'
      )
      .whereRaw('LOWER(cs.email) = ?', [normalized])
      .andWhere('cs.is_active', true)
      .orderBy('cs.created_at', 'desc');
  }

  async findOneByCredentialAndServer(credentialId, serverId) {
    const row = await db('credential_servers as cs')
      .innerJoin('servers as s', 's.id', 'cs.server_id')
      .select('cs.*', 's.servidor', 's.base_price', 's.price_tiers as server_price_tiers')
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
        price_tiers_override: JSON.stringify(item.priceTiersOverride || []),
        is_active: item.isActive
      }));

      for (const item of payload) {
        delete item.credentialId;
        delete item.serverId;
        delete item.priceOverride;
        delete item.priceTiersOverride;
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
