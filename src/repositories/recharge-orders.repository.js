const db = require('../database/knex');
const { createId } = require('../utils/id');

class RechargeOrdersRepository {
  mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      createdByUserId: row.created_by_user_id,
      clientId: row.client_id,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      totalAmount: Number(row.total_amount),
      itemCount: Number(row.item_count),
      pixCode: row.pix_code,
      pixTxid: row.pix_txid,
      pixKeyId: row.pix_key_id,
      requestedByPhone: row.requested_by_phone,
      archived: Boolean(row.archived),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  mapItemRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      orderId: row.order_id,
      credentialId: row.credential_id,
      credentialNome: row.credential_nome,
      credentialLast4: row.credential_last4,
      serverId: row.server_id,
      serverName: row.servidor,
      servidor: row.servidor,
      serverUrl: row.servidor_url ?? null,
      serverUnitCost: row.server_unit_cost != null ? Number(row.server_unit_cost) : 0,
      accountLogin: row.account_login,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      totalAmount: Number(row.total_amount),
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      isPromo: Boolean(row.is_promo),
      promoUnitPrice: row.promo_unit_price != null ? Number(row.promo_unit_price) : null,
      catalogUnitPrice: row.catalog_unit_price != null ? Number(row.catalog_unit_price) : null,
      createdByUserId: row.created_by_user_id,
      createdByUserName: row.created_by_user_name ?? null,
      createdByUserEmail: row.created_by_user_email ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  mapListPageRow(row) {
    if (!row) return null;
    return {
      ...this.mapRow(row),
      createdByUserName: row.created_by_user_name ?? null,
      createdByUserEmail: row.created_by_user_email ?? null
    };
  }

  async create(order, items) {
    return db.transaction(async (trx) => {
      const [orderRow] = await trx('recharge_orders')
        .insert({
          id: order.id,
          created_by_user_id: order.createdByUserId,
          client_id: order.clientId,
          payment_method: order.paymentMethod,
          payment_status: order.paymentStatus,
          total_amount: order.totalAmount,
          item_count: order.itemCount,
          pix_code: order.pixCode,
          pix_txid: order.pixTxid,
          pix_key_id: order.pixKeyId,
          requested_by_phone: order.requestedByPhone
        })
        .returning('*');

      const itemRows = items.map((item) => ({
        id: item.id || createId(),
        order_id: orderRow.id,
        credential_id: item.credentialId,
        server_id: item.serverId,
        created_by_user_id: order.createdByUserId,
        account_login: item.accountLogin,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_amount: item.totalAmount,
        payment_method: order.paymentMethod,
        payment_status: order.paymentStatus,
        pix_code: order.pixCode,
        pix_txid: order.pixTxid,
        requested_by_phone: order.requestedByPhone,
        is_promo: Boolean(item.isPromo),
        promo_unit_price: item.promoUnitPrice ?? null,
        catalog_unit_price: item.catalogUnitPrice ?? null
      }));

      await trx('recharge_requests').insert(itemRows);

      return this.mapRow(orderRow);
    });
  }

  async findById(id) {
    const row = await db('recharge_orders').where({ id }).first();
    return this.mapRow(row);
  }

  async findItemsByOrderId(orderId) {
    const rows = await db('recharge_requests as rr')
      .innerJoin('credentials as c', 'c.id', 'rr.credential_id')
      .innerJoin('servers as s', 's.id', 'rr.server_id')
      .leftJoin('users as u', 'u.id', 'rr.created_by_user_id')
      .where({ 'rr.order_id': orderId })
      .select(
        'rr.*',
        'c.nome as credential_nome',
        'c.last4 as credential_last4',
        's.servidor',
        's.url as servidor_url',
        's.custo_credito as server_unit_cost',
        'u.name as created_by_user_name',
        'u.email as created_by_user_email'
      )
      .orderBy('rr.created_at', 'asc');
    return rows.map((r) => this.mapItemRow(r));
  }

  async findItemsByOrderIds(orderIds) {
    if (!Array.isArray(orderIds) || orderIds.length === 0) return [];
    const rows = await db('recharge_requests as rr')
      .innerJoin('credentials as c', 'c.id', 'rr.credential_id')
      .innerJoin('servers as s', 's.id', 'rr.server_id')
      .leftJoin('users as u', 'u.id', 'rr.created_by_user_id')
      .whereIn('rr.order_id', orderIds)
      .select(
        'rr.*',
        'c.nome as credential_nome',
        'c.last4 as credential_last4',
        's.servidor',
        's.url as servidor_url',
        's.custo_credito as server_unit_cost',
        'u.name as created_by_user_name',
        'u.email as created_by_user_email'
      )
      .orderBy('rr.created_at', 'asc');
    return rows.map((r) => this.mapItemRow(r));
  }

  async findAllForListPage({
    clientId = null,
    limit = 50,
    cursor = null,
    search = null,
    status = null,
    archived = false,
    requireProof = false
  } = {}) {
    let query = db('recharge_orders as o')
      .leftJoin('users as u', 'u.id', 'o.created_by_user_id')
      .select(
        'o.*',
        'u.name as created_by_user_name',
        'u.email as created_by_user_email'
      )
      .where('o.archived', archived === true)
      .orderBy([
        { column: 'o.created_at', order: 'desc' },
        { column: 'o.id', order: 'desc' }
      ])
      .limit(Math.min(Math.max(Number(limit) || 50, 1), 200));

    if (clientId) {
      query = query.where('o.client_id', clientId);
    }

    if (requireProof) {
      query = query.whereExists(function () {
        this.select(db.raw('1'))
          .from('recharge_request_payment_proofs as p')
          .whereRaw('p.recharge_order_id = o.id');
      });
    }

    if (status && status !== 'all') {
      query = query.where('o.payment_status', status);
    }

    if (search && String(search).trim()) {
      const term = `%${String(search).trim().toLowerCase()}%`;
      query = query.where((qb) => {
        qb.whereRaw('LOWER(o.id::text) LIKE ?', [term])
          .orWhereRaw('LOWER(COALESCE(u.name, \'\')) LIKE ?', [term])
          .orWhereRaw('LOWER(COALESCE(u.email, \'\')) LIKE ?', [term])
          .orWhereExists(function () {
            this.select(db.raw('1'))
              .from('recharge_requests as rr')
              .innerJoin('servers as s', 's.id', 'rr.server_id')
              .innerJoin('credentials as c', 'c.id', 'rr.credential_id')
              .whereRaw('rr.order_id = o.id')
              .andWhere((sub) => {
                sub.whereRaw('LOWER(rr.account_login) LIKE ?', [term])
                  .orWhereRaw('LOWER(s.servidor) LIKE ?', [term])
                  .orWhereRaw('LOWER(c.last4) LIKE ?', [term]);
              });
          });
      });
    }

    if (cursor && cursor.createdAt && cursor.id) {
      query = query.where((qb) => {
        qb.where('o.created_at', '<', cursor.createdAt).orWhere((qb2) => {
          qb2.where('o.created_at', cursor.createdAt).andWhere('o.id', '<', cursor.id);
        });
      });
    }

    const rows = await query;
    return rows.map((row) => this.mapListPageRow(row));
  }

  async updatePayment(id, updates) {
    const payload = { updated_at: db.fn.now() };
    if (updates.paymentStatus !== undefined) payload.payment_status = updates.paymentStatus;
    if (updates.paymentMethod !== undefined) payload.payment_method = updates.paymentMethod;
    if (updates.pixCode !== undefined) payload.pix_code = updates.pixCode;
    if (updates.pixTxid !== undefined) payload.pix_txid = updates.pixTxid;
    if (updates.pixKeyId !== undefined) payload.pix_key_id = updates.pixKeyId;

    const [row] = await db('recharge_orders').where({ id }).update(payload).returning('*');
    return this.mapRow(row);
  }

  async updateItemsPaymentStatusByOrderId(orderId, paymentStatus) {
    return db('recharge_requests')
      .where({ order_id: orderId })
      .update({ payment_status: paymentStatus, updated_at: db.fn.now() });
  }

  async archive(id) {
    const [row] = await db('recharge_orders')
      .where({ id })
      .update({ archived: true, updated_at: db.fn.now() })
      .returning('*');
    return this.mapRow(row);
  }

  async countPending(clientId = null) {
    let query = db('recharge_orders')
      .where({ archived: false })
      .whereIn('payment_status', ['pendente_pagamento', 'pix_gerado']);
    if (clientId) query = query.where({ client_id: clientId });
    const result = await query.count('id as count').first();
    return Number(result?.count || 0);
  }
}

module.exports = new RechargeOrdersRepository();
