const db = require('../database/knex');

class RechargeRequestNotificationsRepository {
  mapRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      rechargeRequestId: row.recharge_request_id,
      recipientUserId: row.recipient_user_id,
      eventType: row.event_type,
      deliveryStatus: row.delivery_status,
      attempts: Number(row.attempts || 0),
      sentAt: row.sent_at,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async findByRechargeRequestAndRecipient(rechargeRequestId, recipientUserId, eventType) {
    const row = await db('recharge_request_notifications')
      .where({
        recharge_request_id: rechargeRequestId,
        recipient_user_id: recipientUserId,
        event_type: eventType
      })
      .first();

    return this.mapRow(row);
  }

  async create(payload) {
    const [row] = await db('recharge_request_notifications')
      .insert({
        id: payload.id,
        recharge_request_id: payload.rechargeRequestId,
        recipient_user_id: payload.recipientUserId,
        event_type: payload.eventType,
        delivery_status: payload.deliveryStatus || 'pending',
        attempts: payload.attempts || 0,
        sent_at: payload.sentAt || null,
        error_message: payload.errorMessage || null
      })
      .returning('*');

    return this.mapRow(row);
  }

  async markSent(id) {
    const [row] = await db('recharge_request_notifications')
      .where({ id })
      .update({
        delivery_status: 'sent',
        attempts: db.raw('attempts + 1'),
        sent_at: db.fn.now(),
        error_message: null,
        updated_at: db.fn.now()
      })
      .returning('*');

    return this.mapRow(row);
  }

  async markFailed(id, errorMessage) {
    const [row] = await db('recharge_request_notifications')
      .where({ id })
      .update({
        delivery_status: 'failed',
        attempts: db.raw('attempts + 1'),
        error_message: errorMessage,
        updated_at: db.fn.now()
      })
      .returning('*');

    return this.mapRow(row);
  }
}

module.exports = new RechargeRequestNotificationsRepository();
