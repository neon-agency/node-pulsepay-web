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
      fontFamily: row.font_family ?? null,
      customColor: row.custom_color ?? null,
      domain: row.domain ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findByUserId(userId) {
    const row = await db('white_labels').where({ user_id: userId }).first();
    return this.mapRow(row);
  }

  async findByDomain(domain) {
    if (!domain) return null;
    const normalized = String(domain).trim().toLowerCase();
    if (!normalized) return null;
    const row = await db('white_labels')
      .whereRaw('LOWER(domain) = ?', [normalized])
      .first();
    return this.mapRow(row);
  }

  async upsert(userId, id, { systemName, logoUrl, colorScheme, fontFamily, customColor, domain }) {
    const existing = await db('white_labels').where({ user_id: userId }).first();

    if (existing) {
      const updates = { updated_at: db.fn.now() };
      if (systemName !== undefined) updates.system_name = systemName || null;
      if (logoUrl !== undefined) updates.logo_url = logoUrl || null;
      if (colorScheme !== undefined) updates.color_scheme = colorScheme;
      if (fontFamily !== undefined) updates.font_family = fontFamily || null;
      if (customColor !== undefined) updates.custom_color = customColor || null;
      if (domain !== undefined) updates.domain = domain || null;

      const [row] = await db('white_labels')
        .where({ user_id: userId })
        .update(updates)
        .returning('*');
      return this.mapRow(row);
    }

    const insertPayload = {
      id,
      user_id: userId,
      system_name: systemName || null,
      logo_url: logoUrl || null,
      color_scheme: colorScheme ?? 'default',
      font_family: fontFamily || null,
      custom_color: customColor || null,
      domain: domain || null,
    };
    const [row] = await db('white_labels').insert(insertPayload).returning('*');
    return this.mapRow(row);
  }
}

module.exports = new WhiteLabelRepository();
