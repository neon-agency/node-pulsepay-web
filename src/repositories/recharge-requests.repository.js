const db = require('../database/knex');

class RechargeRequestsRepository {
  mapRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      credentialId: row.credential_id,
      serverId: row.server_id,
      createdByUserId: row.created_by_user_id,
      accountLogin: row.account_login,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      totalAmount: Number(row.total_amount),
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      pixCode: row.pix_code,
      pixTxid: row.pix_txid,
      requestedByPhone: row.requested_by_phone,
      archived: Boolean(row.archived),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  mapRowWithRelations(row) {
    if (!row) return null;

    return {
      ...this.mapRow(row),
      credentialNome: row.credential_nome,
      credentialLast4: row.credential_last4,
      servidor: row.servidor,
      createdByUserName: row.created_by_user_name,
      createdByUserEmail: row.created_by_user_email
    };
  }

  async findAll({ credentialIds } = {}) {
    let query = db('recharge_requests as rr')
      .innerJoin('credentials as c', 'c.id', 'rr.credential_id')
      .innerJoin('servers as s', 's.id', 'rr.server_id')
      .leftJoin('users as u', 'u.id', 'rr.created_by_user_id')
      .select(
        'rr.*',
        'c.nome as credential_nome',
        'c.last4 as credential_last4',
        's.servidor',
        'u.name as created_by_user_name',
        'u.email as created_by_user_email'
      )
      .orderBy('rr.created_at', 'desc');

    if (Array.isArray(credentialIds) && credentialIds.length > 0) {
      query = query.whereIn('rr.credential_id', credentialIds);
    }

    const rows = await query;
    return rows.map((row) => this.mapRowWithRelations(row));
  }

  async findById(id) {
    const row = await db('recharge_requests as rr')
      .innerJoin('credentials as c', 'c.id', 'rr.credential_id')
      .innerJoin('servers as s', 's.id', 'rr.server_id')
      .leftJoin('users as u', 'u.id', 'rr.created_by_user_id')
      .select(
        'rr.*',
        'c.nome as credential_nome',
        'c.last4 as credential_last4',
        's.servidor',
        'u.name as created_by_user_name',
        'u.email as created_by_user_email'
      )
      .where({ 'rr.id': id })
      .first();

    return this.mapRowWithRelations(row);
  }

  async create(item) {
    const payload = {
      ...item,
      credential_id: item.credentialId,
      server_id: item.serverId,
      created_by_user_id: item.createdByUserId,
      account_login: item.accountLogin,
      unit_price: item.unitPrice,
      total_amount: item.totalAmount,
      payment_method: item.paymentMethod,
      payment_status: item.paymentStatus,
      pix_code: item.pixCode,
      pix_txid: item.pixTxid,
      requested_by_phone: item.requestedByPhone
    };

    delete payload.credentialId;
    delete payload.serverId;
    delete payload.accountLogin;
    delete payload.createdByUserId;
    delete payload.unitPrice;
    delete payload.totalAmount;
    delete payload.paymentMethod;
    delete payload.paymentStatus;
    delete payload.pixCode;
    delete payload.pixTxid;
    delete payload.requestedByPhone;

    const [row] = await db('recharge_requests').insert(payload).returning('*');
    return this.mapRow(row);
  }

  async updatePayment(id, updates) {
    const payload = {
      ...updates,
      payment_method: updates.paymentMethod,
      payment_status: updates.paymentStatus,
      pix_code: updates.pixCode,
      pix_txid: updates.pixTxid,
      updated_at: db.fn.now()
    };

    delete payload.paymentMethod;
    delete payload.paymentStatus;
    delete payload.pixCode;
    delete payload.pixTxid;

    const [row] = await db('recharge_requests')
      .where({ id })
      .update(payload)
      .returning('*');

    return this.mapRow(row);
  }

  async archive(id) {
    const [row] = await db('recharge_requests')
      .where({ id })
      .update({ archived: true, updated_at: db.fn.now() })
      .returning('*');
    return this.mapRow(row);
  }

  async findPaid() {
    const rows = await db('recharge_requests as rr')
      .innerJoin('credentials as c', 'c.id', 'rr.credential_id')
      .innerJoin('servers as s', 's.id', 'rr.server_id')
      .leftJoin('users as u', 'u.id', 'rr.created_by_user_id')
      .select(
        'rr.*',
        'c.nome as credential_nome',
        'c.last4 as credential_last4',
        's.servidor',
        'u.name as created_by_user_name',
        'u.email as created_by_user_email'
      )
      .where({ 'rr.payment_status': 'pago' })
      .orderBy('rr.updated_at', 'desc');

    return rows.map((row) => this.mapRowWithRelations(row));
  }
}

module.exports = new RechargeRequestsRepository();
