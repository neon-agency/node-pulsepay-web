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
      isPromo: Boolean(row.is_promo),
      promoUnitPrice: row.promo_unit_price != null ? Number(row.promo_unit_price) : null,
      catalogUnitPrice: row.catalog_unit_price != null ? Number(row.catalog_unit_price) : null,
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
      servidorUrl: row.servidor_url ?? null,
      serverLogin: row.server_login ?? null,
      serverUnitCost: row.server_unit_cost != null ? Number(row.server_unit_cost) : 0,
      createdByUserName: row.created_by_user_name,
      createdByUserEmail: row.created_by_user_email
    };
  }

  mapListPageRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      serverId: row.server_id,
      serverName: row.servidor,
      serverUrl: row.servidor_url ?? null,
      serverLogin: row.server_login ?? null,
      accountLogin: row.account_login,
      credentialLast4: row.credential_last4,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      totalAmount: Number(row.total_amount),
      paymentStatus: row.payment_status,
      archived: Boolean(row.archived),
      isPromo: Boolean(row.is_promo),
      promoUnitPrice: row.promo_unit_price != null ? Number(row.promo_unit_price) : null,
      catalogUnitPrice: row.catalog_unit_price != null ? Number(row.catalog_unit_price) : null,
      serverUnitCost: row.server_unit_cost != null ? Number(row.server_unit_cost) : 0,
      createdAt: row.created_at,
      createdByUserName: row.created_by_user_name ?? null,
      createdByUserEmail: row.created_by_user_email ?? null
    };
  }

  async findAllForListPage({
    credentialIds,
    limit = 50,
    cursor = null,
    search = null,
    status = null,
    archived = false,
    requireProof = false
  } = {}) {
    let query = db('recharge_requests as rr')
      .innerJoin('servers as s', 's.id', 'rr.server_id')
      .innerJoin('credentials as c', 'c.id', 'rr.credential_id')
      .leftJoin('users as u', 'u.id', 'rr.created_by_user_id')
      .select(
        'rr.id',
        'rr.server_id',
        'rr.account_login',
        'rr.quantity',
        'rr.unit_price',
        'rr.total_amount',
        'rr.payment_status',
        'rr.archived',
        'rr.is_promo',
        'rr.promo_unit_price',
        'rr.catalog_unit_price',
        'rr.created_at',
        's.servidor',
        's.url as servidor_url',
        's.login as server_login',
        's.custo_credito as server_unit_cost',
        'c.last4 as credential_last4',
        'u.name as created_by_user_name',
        'u.email as created_by_user_email'
      )
      .where('rr.archived', archived === true)
      .orderBy([
        { column: 'rr.created_at', order: 'desc' },
        { column: 'rr.id', order: 'desc' }
      ])
      .limit(Math.min(Math.max(Number(limit) || 50, 1), 200));

    if (Array.isArray(credentialIds) && credentialIds.length > 0) {
      query = query.whereIn('rr.credential_id', credentialIds);
    }

    if (requireProof) {
      query = query.whereExists(function () {
        this.select(db.raw('1'))
          .from('recharge_request_payment_proofs as p')
          .whereRaw('p.recharge_request_id = rr.id');
      });
    }

    if (status && status !== 'all') {
      query = query.where('rr.payment_status', status);
    }

    if (search && String(search).trim()) {
      const term = `%${String(search).trim().toLowerCase()}%`;
      query = query.where((qb) => {
        qb.whereRaw('LOWER(rr.id::text) LIKE ?', [term])
          .orWhereRaw('LOWER(rr.account_login) LIKE ?', [term])
          .orWhereRaw('LOWER(s.servidor) LIKE ?', [term])
          .orWhereRaw('LOWER(c.last4) LIKE ?', [term])
          .orWhereRaw('LOWER(COALESCE(u.name, \'\')) LIKE ?', [term])
          .orWhereRaw('LOWER(COALESCE(u.email, \'\')) LIKE ?', [term]);
      });
    }

    if (cursor && cursor.createdAt && cursor.id) {
      query = query.where((qb) => {
        qb.where('rr.created_at', '<', cursor.createdAt)
          .orWhere((qb2) => {
            qb2.where('rr.created_at', cursor.createdAt).andWhere('rr.id', '<', cursor.id);
          });
      });
    }

    const rows = await query;
    return rows.map((row) => this.mapListPageRow(row));
  }

  async findAll({ credentialIds, requireProof = false } = {}) {
    let query = db('recharge_requests as rr')
      .innerJoin('credentials as c', 'c.id', 'rr.credential_id')
      .innerJoin('servers as s', 's.id', 'rr.server_id')
      .leftJoin('users as u', 'u.id', 'rr.created_by_user_id')
      .select(
        'rr.*',
        'c.nome as credential_nome',
        'c.last4 as credential_last4',
        's.servidor',
        's.url as servidor_url',
        's.login as server_login',
        's.custo_credito as server_unit_cost',
        'u.name as created_by_user_name',
        'u.email as created_by_user_email'
      )
      .orderBy('rr.created_at', 'desc');

    if (Array.isArray(credentialIds) && credentialIds.length > 0) {
      query = query.whereIn('rr.credential_id', credentialIds);
    }

    if (requireProof) {
      query = query.whereExists(function () {
        this.select(db.raw('1'))
          .from('recharge_request_payment_proofs as p')
          .whereRaw('p.recharge_request_id = rr.id');
      });
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
        's.url as servidor_url',
        's.login as server_login',
        's.custo_credito as server_unit_cost',
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
      requested_by_phone: item.requestedByPhone,
      is_promo: Boolean(item.isPromo),
      promo_unit_price: item.promoUnitPrice ?? null,
      catalog_unit_price: item.catalogUnitPrice ?? null
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
    delete payload.isPromo;
    delete payload.promoUnitPrice;
    delete payload.catalogUnitPrice;

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

  async deleteById(id) {
    return db('recharge_requests').where({ id }).del();
  }
}

module.exports = new RechargeRequestsRepository();
