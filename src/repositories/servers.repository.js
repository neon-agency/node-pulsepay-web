const db = require('../database/knex');

class ServersRepository {
  mapRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      servidor: row.servidor,
      url: row.url,
      basePrice: Number(row.base_price),
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
      base_price: server.basePrice
    };

    delete payload.basePrice;
    const [row] = await db('servers').insert(payload).returning('*');
    return this.mapRow(row);
  }

  async update(id, updates) {
    const payload = {
      ...updates,
      base_price: updates.basePrice,
      updated_at: db.fn.now()
    };

    delete payload.basePrice;

    const [row] = await db('servers')
      .where({ id })
      .update(payload)
      .returning('*');

    return this.mapRow(row);
  }

  async remove(id) {
    const deleted = await db('servers').where({ id }).del();
    return deleted > 0;
  }
}

module.exports = new ServersRepository();
