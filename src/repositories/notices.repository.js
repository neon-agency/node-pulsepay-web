const db = require('../database/knex');

class NoticesRepository {
  mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      text: row.text ?? '',
      bannerUrl: row.banner_url ?? null,
      isActive: Boolean(row.is_active),
      startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : null,
      endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
      createdByUserId: row.created_by_user_id ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async findAll() {
    const rows = await db('notices').orderBy('created_at', 'desc');
    return rows.map((row) => this.mapRow(row));
  }

  async findActiveAtNow() {
    const rows = await db('notices')
      .where('is_active', true)
      .andWhere((qb) => {
        qb.whereNull('starts_at').orWhere('starts_at', '<=', db.fn.now());
      })
      .andWhere((qb) => {
        qb.whereNull('ends_at').orWhere('ends_at', '>=', db.fn.now());
      })
      .orderBy('created_at', 'desc');
    return rows.map((row) => this.mapRow(row));
  }

  async findById(id) {
    const row = await db('notices').where({ id }).first();
    return this.mapRow(row);
  }

  async create(item) {
    const payload = {
      id: item.id,
      title: item.title,
      text: item.text ?? '',
      banner_url: item.bannerUrl ?? null,
      is_active: Boolean(item.isActive),
      starts_at: item.startsAt ?? null,
      ends_at: item.endsAt ?? null,
      created_by_user_id: item.createdByUserId ?? null
    };
    const [row] = await db('notices').insert(payload).returning('*');
    return this.mapRow(row);
  }

  async update(id, updates) {
    const payload = { updated_at: db.fn.now() };
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.text !== undefined) payload.text = updates.text ?? '';
    if (updates.bannerUrl !== undefined) payload.banner_url = updates.bannerUrl;
    if (updates.isActive !== undefined) payload.is_active = Boolean(updates.isActive);
    if (updates.startsAt !== undefined) payload.starts_at = updates.startsAt;
    if (updates.endsAt !== undefined) payload.ends_at = updates.endsAt;

    const [row] = await db('notices').where({ id }).update(payload).returning('*');
    return this.mapRow(row);
  }

  async remove(id) {
    return db('notices').where({ id }).del();
  }
}

module.exports = new NoticesRepository();
