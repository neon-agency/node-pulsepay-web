const db = require('../database/knex');

class BotSessionsRepository {
  mapRow(row) {
    if (!row) return null;

    let payload = {};
    try {
      payload = JSON.parse(row.payload_json || '{}');
    } catch (_error) {
      payload = {};
    }

    return {
      phone: row.phone,
      ...payload,
      stage: row.stage || payload.stage || 'START',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async getOrCreate(phone) {
    const existing = await db('bot_sessions').where({ phone }).first();
    if (existing) {
      return this.mapRow(existing);
    }

    await db('bot_sessions').insert({
      phone,
      stage: 'START',
      payload_json: JSON.stringify({})
    });

    return { stage: 'START' };
  }

  async save(phone, session) {
    const payload = { ...(session || {}) };
    delete payload.stage;

    const stage = session?.stage || 'START';

    await db('bot_sessions')
      .insert({
        phone,
        stage,
        payload_json: JSON.stringify(payload),
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .onConflict('phone')
      .merge({
        stage,
        payload_json: JSON.stringify(payload),
        updated_at: db.fn.now()
      });

    return {
      ...payload,
      stage
    };
  }

  async reset(phone) {
    await db('bot_sessions')
      .insert({
        phone,
        stage: 'START',
        payload_json: JSON.stringify({}),
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .onConflict('phone')
      .merge({
        stage: 'START',
        payload_json: JSON.stringify({}),
        updated_at: db.fn.now()
      });

    return { stage: 'START' };
  }

  async listActiveSessions() {
    const rows = await db('bot_sessions')
      .whereNot({ stage: 'START' })
      .select('*');

    return rows.map((row) => this.mapRow(row));
  }
}

module.exports = new BotSessionsRepository();
