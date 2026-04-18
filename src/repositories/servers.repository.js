const db = require('../database/knex');

class ServersRepository {
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
      servidor: row.servidor,
      url: row.url,
      basePrice: Number(row.base_price),
      priceTiers: this.normalizePriceTiers(row.price_tiers),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async findAll() {
    const rows = await db('servers').select('*').orderBy('created_at', 'desc');
    return rows.map((row) => this.mapRow(row));
  }

  async findById(id) {
    const row = await db('servers').where({ id }).first();
    return this.mapRow(row);
  }

  async create(server) {
    const payload = {
      ...server,
      base_price: server.basePrice,
      price_tiers: JSON.stringify(server.priceTiers || [])
    };

    delete payload.basePrice;
    delete payload.priceTiers;
    const [row] = await db('servers').insert(payload).returning('*');
    return this.mapRow(row);
  }

  async update(id, updates) {
    const payload = {
      ...updates,
      base_price: updates.basePrice,
      price_tiers: JSON.stringify(updates.priceTiers || []),
      updated_at: db.fn.now()
    };

    delete payload.basePrice;
    delete payload.priceTiers;

    const [row] = await db('servers')
      .where({ id })
      .update(payload)
      .returning('*');

    return this.mapRow(row);
  }

  async remove(id) {
    return db.transaction(async (trx) => {
      await trx('credential_servers').where({ server_id: id }).del();
      const deleted = await trx('servers').where({ id }).del();
      return deleted > 0;
    });
  }
}

module.exports = new ServersRepository();
