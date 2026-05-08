const db = require('../database/knex');

class PlansRepository {
  mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      priceCents: row.price_cents,
      currency: row.currency,
      stripePriceId: row.stripe_price_id || null,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async findAllActive() {
    const rows = await db('plans')
      .where({ is_active: true })
      .orderBy('price_cents', 'asc');
    return rows.map((row) => this.mapRow(row));
  }

  async findById(id) {
    const row = await db('plans').where({ id }).first();
    return this.mapRow(row);
  }

  async findByName(name) {
    const row = await db('plans')
      .whereRaw('LOWER(name) = LOWER(?)', [String(name || '')])
      .first();
    return this.mapRow(row);
  }

  async create(payload) {
    const [row] = await db('plans')
      .insert({
        id: payload.id,
        name: payload.name,
        price_cents: payload.priceCents,
        currency: payload.currency || 'BRL',
        stripe_price_id: payload.stripePriceId || null,
        is_active: payload.isActive ?? true
      })
      .returning('*');

    return this.mapRow(row);
  }

  async updateStripePriceId(id, stripePriceId) {
    const [row] = await db('plans')
      .where({ id })
      .update({
        stripe_price_id: stripePriceId || null,
        updated_at: db.fn.now()
      })
      .returning('*');

    return this.mapRow(row);
  }

  async updateById(id, updates) {
    const payload = updates && typeof updates === 'object' ? updates : {};

    const [row] = await db('plans')
      .where({ id })
      .update({
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.priceCents !== undefined ? { price_cents: payload.priceCents } : {}),
        ...(payload.currency !== undefined ? { currency: payload.currency } : {}),
        ...(payload.stripePriceId !== undefined ? { stripe_price_id: payload.stripePriceId } : {}),
        ...(payload.isActive !== undefined ? { is_active: payload.isActive } : {}),
        updated_at: db.fn.now()
      })
      .returning('*');

    return this.mapRow(row);
  }

  async deactivateAllExceptNames(allowedNames) {
    const normalized = (Array.isArray(allowedNames) ? allowedNames : []).map((n) => String(n || '').toLowerCase());
    const rows = await db('plans')
      .where({ is_active: true })
      .andWhereRaw('LOWER(name) NOT IN (' + normalized.map(() => '?').join(',') + ')', normalized)
      .update({ is_active: false, updated_at: db.fn.now() })
      .returning('*');

    return rows.map((row) => this.mapRow(row));
  }
}

module.exports = new PlansRepository();
