const db = require('../database/knex');

class StoreSettingsRepository {
  mapRow(row) {
    if (!row) return null;

    let openDays = null;
    if (row.open_days) {
      try {
        openDays = typeof row.open_days === 'string' ? JSON.parse(row.open_days) : row.open_days;
      } catch {
        openDays = null;
      }
    }

    return {
      id: row.id,
      adminId: row.admin_id,
      isOpen: row.is_open == null ? true : Boolean(row.is_open),
      openingTime: row.opening_time ?? null,
      closingTime: row.closing_time ?? null,
      openDays: Array.isArray(openDays) ? openDays : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async findByAdminId(adminId) {
    const row = await db('store_settings').where({ admin_id: adminId }).first();
    return this.mapRow(row);
  }

  async upsert(adminId, id, { isOpen, openingTime, closingTime, openDays }) {
    const existing = await db('store_settings').where({ admin_id: adminId }).first();

    if (existing) {
      const updates = { updated_at: db.fn.now() };
      if (isOpen !== undefined) updates.is_open = Boolean(isOpen);
      if (openingTime !== undefined) updates.opening_time = openingTime || null;
      if (closingTime !== undefined) updates.closing_time = closingTime || null;
      if (openDays !== undefined) {
        updates.open_days = Array.isArray(openDays) && openDays.length > 0 ? JSON.stringify(openDays) : null;
      }

      const [row] = await db('store_settings')
        .where({ admin_id: adminId })
        .update(updates)
        .returning('*');
      return this.mapRow(row);
    }

    const [row] = await db('store_settings')
      .insert({
        id,
        admin_id: adminId,
        is_open: isOpen === undefined ? true : Boolean(isOpen),
        opening_time: openingTime || null,
        closing_time: closingTime || null,
        open_days: Array.isArray(openDays) && openDays.length > 0 ? JSON.stringify(openDays) : null
      })
      .returning('*');
    return this.mapRow(row);
  }
}

module.exports = new StoreSettingsRepository();
