const db = require('../database/knex');

class UserPreferencesRepository {
  mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      theme: row.theme ?? 'system',
      colorScheme: row.color_scheme ?? null,
      customColor: row.custom_color ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findByUserId(userId) {
    const row = await db('user_preferences').where({ user_id: userId }).first();
    return this.mapRow(row);
  }

  async upsert(userId, id, { theme, colorScheme, customColor }) {
    const existing = await db('user_preferences').where({ user_id: userId }).first();

    if (existing) {
      const updates = { updated_at: db.fn.now() };
      if (theme !== undefined) updates.theme = theme;
      if (colorScheme !== undefined) updates.color_scheme = colorScheme || null;
      if (customColor !== undefined) updates.custom_color = customColor || null;

      const [row] = await db('user_preferences')
        .where({ user_id: userId })
        .update(updates)
        .returning('*');
      return this.mapRow(row);
    }

    const [row] = await db('user_preferences').insert({
      id,
      user_id: userId,
      theme: theme ?? 'system',
      color_scheme: colorScheme || null,
      custom_color: customColor || null,
    }).returning('*');
    return this.mapRow(row);
  }
}

module.exports = new UserPreferencesRepository();
