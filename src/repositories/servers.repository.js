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
      promoPriceTiers: this.normalizePriceTiers(row.promo_price_tiers),
      promoActive: Boolean(row.promo_active),
      promoExpiresAt: row.promo_expires_at ? new Date(row.promo_expires_at).toISOString() : null,
      custoCredito: Number(row.custo_credito ?? 0),
      estoque: Number(row.estoque ?? 0),
      estoqueAlerta: row.estoque_alerta != null ? Number(row.estoque_alerta) : null,
      resellerCount: row.reseller_count != null ? Number(row.reseller_count) : 0,
      clientCount: row.client_count != null ? Number(row.client_count) : 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async expireOutdatedPromos() {
    await db('servers')
      .where('promo_active', true)
      .whereNotNull('promo_expires_at')
      .where('promo_expires_at', '<=', db.fn.now())
      .update({ promo_active: false, updated_at: db.fn.now() });
  }

  async findAll() {
    await this.expireOutdatedPromos();

    const resellerSubquery = db('credential_servers as cs')
      .join('credentials as c', 'c.id', 'cs.credential_id')
      .join('clients as cl', 'cl.id', 'c.client_id')
      .where('cs.is_active', true)
      .where('cl.tipo', 'revenda')
      .groupBy('cs.server_id')
      .select('cs.server_id', db.raw('COUNT(DISTINCT c.client_id) as reseller_count'));

    const clientCountSubquery = db('clients')
      .whereNotNull('servidor_id')
      .groupBy('servidor_id')
      .select('servidor_id', db.raw('COUNT(*) as client_count'));

    const rows = await db('servers as s')
      .leftJoin(resellerSubquery.as('rc'), 'rc.server_id', 's.id')
      .leftJoin(clientCountSubquery.as('cc'), 'cc.servidor_id', 's.id')
      .select(
        's.*',
        db.raw('COALESCE(rc.reseller_count, 0) as reseller_count'),
        db.raw('COALESCE(cc.client_count, 0) as client_count')
      )
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
    await this.expireOutdatedPromos();
    const row = await db('servers').where({ id }).first();
    return this.mapRow(row);
  }

  async create(server) {
    const payload = {
      ...server,
      base_price: server.basePrice,
      price_tiers: JSON.stringify(server.priceTiers || []),
      promo_price_tiers: JSON.stringify(server.promoPriceTiers || []),
      promo_active: Boolean(server.promoActive),
      promo_expires_at: server.promoExpiresAt ?? null,
      custo_credito: server.custoCredito ?? 0,
      estoque_alerta: server.estoqueAlerta ?? null
    };

    delete payload.basePrice;
    delete payload.priceTiers;
    delete payload.promoPriceTiers;
    delete payload.promoActive;
    delete payload.promoExpiresAt;
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

    if (updates.promoPriceTiers !== undefined) {
      payload.promo_price_tiers = JSON.stringify(updates.promoPriceTiers || []);
    }
    if (updates.promoActive !== undefined) {
      payload.promo_active = Boolean(updates.promoActive);
    }
    if (updates.promoExpiresAt !== undefined) {
      payload.promo_expires_at = updates.promoExpiresAt;
    }

    delete payload.basePrice;
    delete payload.priceTiers;
    delete payload.promoPriceTiers;
    delete payload.promoActive;
    delete payload.promoExpiresAt;
    delete payload.custoCredito;
    delete payload.estoqueAlerta;

    const [row] = await db('servers')
      .where({ id })
      .update(payload)
      .returning('*');

    return this.mapRow(row);
  }

  async updatePromo(id, { promoActive, promoExpiresAt, promoPriceTiers }) {
    const payload = { updated_at: db.fn.now() };
    if (promoActive !== undefined) payload.promo_active = Boolean(promoActive);
    if (promoExpiresAt !== undefined) payload.promo_expires_at = promoExpiresAt;
    if (promoPriceTiers !== undefined) payload.promo_price_tiers = JSON.stringify(promoPriceTiers || []);

    const [row] = await db('servers').where({ id }).update(payload).returning('*');
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
