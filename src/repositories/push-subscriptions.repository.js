const db = require('../database/knex');

class PushSubscriptionsRepository {
  mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
      userAgent: row.user_agent ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // Upsert por endpoint: o mesmo dispositivo/navegador reusa o endpoint, então
  // re-inscrever apenas atualiza o dono e as chaves.
  async upsert({ id, userId, endpoint, p256dh, auth, userAgent }) {
    const [row] = await db('push_subscriptions')
      .insert({
        id,
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent || null
      })
      .onConflict('endpoint')
      .merge({
        user_id: userId,
        p256dh,
        auth,
        user_agent: userAgent || null,
        updated_at: db.fn.now()
      })
      .returning('*');
    return this.mapRow(row);
  }

  async deleteByEndpoint(endpoint) {
    return db('push_subscriptions').where({ endpoint }).del();
  }

  async findByUserId(userId) {
    const rows = await db('push_subscriptions').where({ user_id: userId });
    return rows.map((r) => this.mapRow(r));
  }

  async findByUserIds(userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) return [];
    const rows = await db('push_subscriptions').whereIn('user_id', userIds);
    return rows.map((r) => this.mapRow(r));
  }
}

module.exports = new PushSubscriptionsRepository();
