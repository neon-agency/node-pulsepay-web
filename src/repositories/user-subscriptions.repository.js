const db = require('../database/knex');

class UserSubscriptionsRepository {
  mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      planId: row.plan_id,
      status: row.status,
      paymentProvider: row.payment_provider || null,
      paymentProviderId: row.payment_provider_id || null,
      paymentJson: row.payment_json || null,
      activatedAt: row.activated_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async findLatestByUserId(userId) {
    const row = await db('user_subscriptions')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .first();
    return this.mapRow(row);
  }

  async create(payload) {
    const [row] = await db('user_subscriptions')
      .insert({
        id: payload.id,
        user_id: payload.userId,
        plan_id: payload.planId,
        status: payload.status || 'pending',
        payment_provider: payload.paymentProvider || null,
        payment_provider_id: payload.paymentProviderId || null,
        payment_json: payload.paymentJson || null,
        activated_at: payload.activatedAt || null
      })
      .returning('*');
    return this.mapRow(row);
  }

  async updatePayment(id, { paymentProvider, paymentProviderId, paymentJson }) {
    const [row] = await db('user_subscriptions')
      .where({ id })
      .update({
        payment_provider: paymentProvider || null,
        payment_provider_id: paymentProviderId || null,
        payment_json: paymentJson || null,
        updated_at: db.fn.now()
      })
      .returning('*');
    return this.mapRow(row);
  }

  async markActive(id) {
    const [row] = await db('user_subscriptions')
      .where({ id })
      .update({
        status: 'active',
        activated_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning('*');
    return this.mapRow(row);
  }
}

module.exports = new UserSubscriptionsRepository();

