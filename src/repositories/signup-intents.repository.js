const db = require('../database/knex');

function clamp(value, maxLength) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

class SignupIntentsRepository {
  mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      whatsappPhone: row.whatsapp_phone,
      passwordHash: row.password_hash,
      planId: row.plan_id,
      status: row.status,
      paymentProvider: row.payment_provider || null,
      paymentProviderId: row.payment_provider_id || null,
      paymentJson: row.payment_json || null,
      paidAt: row.paid_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async findById(id) {
    const row = await db('signup_intents').where({ id }).first();
    return this.mapRow(row);
  }

  async findLatestByEmail(email) {
    const row = await db('signup_intents')
      .whereRaw('LOWER(email) = LOWER(?)', [String(email || '')])
      .orderBy('created_at', 'desc')
      .first();
    return this.mapRow(row);
  }

  async create(payload) {
    const [row] = await db('signup_intents')
      .insert({
        id: payload.id,
        name: clamp(payload.name, 160),
        email: clamp(payload.email, 160),
        whatsapp_phone: clamp(payload.whatsappPhone, 32),
        password_hash: payload.passwordHash,
        plan_id: payload.planId,
        status: payload.status || 'pending_payment',
        payment_provider: clamp(payload.paymentProvider, 32),
        payment_provider_id: clamp(payload.paymentProviderId, 128),
        payment_json: payload.paymentJson || null,
        paid_at: payload.paidAt || null
      })
      .returning('*');
    return this.mapRow(row);
  }

  async updatePayment(id, { paymentProvider, paymentProviderId, paymentJson }) {
    const [row] = await db('signup_intents')
      .where({ id })
      .update({
        payment_provider: clamp(paymentProvider, 32),
        payment_provider_id: clamp(paymentProviderId, 128),
        payment_json: paymentJson || null,
        updated_at: db.fn.now()
      })
      .returning('*');
    return this.mapRow(row);
  }

  async markPaid(id) {
    const [row] = await db('signup_intents')
      .where({ id })
      .update({
        status: 'paid',
        paid_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning('*');
    return this.mapRow(row);
  }

  async markAccountCreated(id) {
    const [row] = await db('signup_intents')
      .where({ id })
      .update({
        status: 'account_created',
        updated_at: db.fn.now()
      })
      .returning('*');
    return this.mapRow(row);
  }
}

module.exports = new SignupIntentsRepository();

