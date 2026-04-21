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
      custoCredito: Number(row.custo_credito ?? 0),
      estoque: Number(row.estoque ?? 0),
      estoqueAlerta: row.estoque_alerta != null ? Number(row.estoque_alerta) : null,
      resellerCount: row.reseller_count != null ? Number(row.reseller_count) : 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async findAll() {
    const resellerSubquery = db('credential_servers as cs')
      .join('credentials as c', 'c.id', 'cs.credential_id')
      .join('clients as cl', 'cl.id', 'c.client_id')
      .where('cs.is_active', true)
      .where('cl.tipo', 'revenda')
      .groupBy('cs.server_id')
      .select('cs.server_id', db.raw('COUNT(DISTINCT c.client_id) as reseller_count'));

    const rows = await db('servers as s')
      .leftJoin(resellerSubquery.as('rc'), 'rc.server_id', 's.id')
      .select('s.*', db.raw('COALESCE(rc.reseller_count, 0) as reseller_count'))
      .orderBy('s.created_at', 'desc');
    return rows.map((row) => this.mapRow(row));
  }

  async decrementStock(id, quantity) {
    const delta = Math.max(0, Math.trunc(Number(quantity) || 0));
    if (delta === 0) return null;

    const [row] = await db('servers')
      .where({ id })
      .update({
        estoque: db.raw('GREATEST(estoque - ?, 0)', [delta]),
        updated_at: db.fn.now()
      })
      .returning('*');
    return this.mapRow(row);
  }

  async findById(id) {
    const row = await db('servers').where({ id }).first();
    return this.mapRow(row);
  }

  async create(server) {
    const payload = {
      ...server,
      base_price: server.basePrice,
      price_tiers: JSON.stringify(server.priceTiers || []),
      custo_credito: server.custoCredito ?? 0,
      estoque_alerta: server.estoqueAlerta ?? null
    };

    delete payload.basePrice;
    delete payload.priceTiers;
    delete payload.custoCredito;
    delete payload.estoqueAlerta;
    const [row] = await db('servers').insert(payload).returning('*');
    return this.mapRow(row);
  }

  async update(id, updates) {
    const payload = {
      ...updates,
      base_price: updates.basePrice,
      price_tiers: JSON.stringify(updates.priceTiers || []),
      custo_credito: updates.custoCredito ?? 0,
      estoque_alerta: updates.estoqueAlerta ?? null,
      updated_at: db.fn.now()
    };

    delete payload.basePrice;
    delete payload.priceTiers;
    delete payload.custoCredito;
    delete payload.estoqueAlerta;

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
