const db = require('../database/knex');

class WhiteLabelRepository {
  mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      systemName: row.system_name ?? null,
      logoUrl: row.logo_url ?? null,
      colorScheme: row.color_scheme,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findByUserId(userId) {
    const row = await db('white_labels').where({ user_id: userId }).first();
    return this.mapRow(row);
  }

  async upsert(userId, id, { systemName, logoUrl, colorScheme }) {
    const existing = await db('white_labels').where({ user_id: userId }).first();

    if (existing) {
      const updates = { updated_at: db.fn.now() };
      if (systemName !== undefined) updates.system_name = systemName || null;
      if (logoUrl !== undefined) updates.logo_url = logoUrl || null;
      if (colorScheme !== undefined) updates.color_scheme = colorScheme;

      const [row] = await db('white_labels')
        .where({ user_id: userId })
        .update(updates)
        .returning('*');
      return this.mapRow(row);
    }

    const [row] = await db('white_labels')
      .insert({
        id,
        user_id: userId,
        system_name: systemName || null,
        logo_url: logoUrl || null,
        color_scheme: colorScheme ?? 'default',
      })
      .returning('*');
    return this.mapRow(row);
  }
}

module.exports = new WhiteLabelRepository();
