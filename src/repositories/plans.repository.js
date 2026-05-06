const db = require('../database/knex');

class PlansRepository {
  mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      priceCents: row.price_cents,
      currency: row.currency,
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
        is_active: payload.isActive ?? true
      })
      .returning('*');

    return this.mapRow(row);
  }
}

module.exports = new PlansRepository();

