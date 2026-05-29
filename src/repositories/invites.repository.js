const db = require('../database/knex');

class InvitesRepository {
  mapRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      tokenHash: row.token_hash,
      tokenPreview: row.token_preview,
      name: row.name ?? null,
      adminId: row.admin_id,
      expiresAt: row.expires_at,
      usageCount: typeof row.usage_count === 'number' ? row.usage_count : Number(row.usage_count) || 0,
      revokedAt: row.revoked_at,
      revokedByUserId: row.revoked_by_user_id ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async create(payload) {
    const [row] = await db('invites')
      .insert({
        id: payload.id,
        token_hash: payload.tokenHash,
        token_preview: payload.tokenPreview,
        name: payload.name ?? null,
        admin_id: payload.adminId,
        expires_at: payload.expiresAt
      })
      .returning('*');

    return this.mapRow(row);
  }

  async findByTokenHash(tokenHash, trx) {
    const conn = trx || db;
    const row = await conn('invites').where({ token_hash: tokenHash }).first();
    return this.mapRow(row);
  }

  async findByIdScoped(adminId, id) {
    const row = await db('invites').where({ id, admin_id: adminId }).first();
    return this.mapRow(row);
  }

  async listByAdmin(adminId) {
    const rows = await db('invites')
      .where({ admin_id: adminId })
      .orderBy('created_at', 'desc');
    return rows.map((row) => this.mapRow(row));
  }

  async markRevoked({ id, userId }) {
    const [row] = await db('invites')
      .where({ id })
      .whereNull('revoked_at')
      .update({
        revoked_at: db.fn.now(),
        revoked_by_user_id: userId || null,
        updated_at: db.fn.now()
      })
      .returning('*');

    return this.mapRow(row);
  }

  async deleteById(id) {
    return db('invites').where({ id }).del();
  }

  async renewToken({ id, tokenHash, tokenPreview, expiresAt }) {
    const [row] = await db('invites')
      .where({ id })
      .update({
        token_hash: tokenHash,
        token_preview: tokenPreview,
        expires_at: expiresAt,
        revoked_at: null,
        revoked_by_user_id: null,
        updated_at: db.fn.now()
      })
      .returning('*');
    return this.mapRow(row);
  }

  async incrementUsage({ id, trx }) {
    const conn = trx || db;
    const [row] = await conn('invites')
      .where({ id })
      .whereNull('revoked_at')
      .where('expires_at', '>', conn.fn.now())
      .update({
        usage_count: conn.raw('usage_count + 1'),
        updated_at: conn.fn.now()
      })
      .returning('*');

    return this.mapRow(row);
  }
}

module.exports = new InvitesRepository();
