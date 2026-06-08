const AppError = require('../errors/app-error');
const RechargeOrderModel = require('../models/recharge-order.model');
const rechargeOrdersRepository = require('../repositories/recharge-orders.repository');
const rechargeRequestsService = require('./recharge-requests.service');
const credentialsRepository = require('../repositories/credentials.repository');
const serversRepository = require('../repositories/servers.repository');
const paymentProofsRepository = require('../repositories/recharge-request-payment-proofs.repository');
const pixKeysService = require('./pix-keys.service');
const pixKeysRepository = require('../repositories/pix-keys.repository');
const salesNotificationsService = require('./sales-notifications.service');
const rechargeCancellationNotificationsService = require('./recharge-cancellation-notifications.service');

const DEFAULT_PIX_KEY = process.env.PIX_KEY || 'b0944752-7136-49ef-920a-0d21a3aa4be5';

async function resolvePixForOrder(firstItem, currentUser) {
  try {
    const linkKey = await pixKeysService.resolvePixKeyForLink(firstItem.credentialId, firstItem.serverId);
    if (linkKey?.chave) return { chave: linkKey.chave, id: linkKey.id };
  } catch (_err) {
    /* ignore */
  }

  if (currentUser?.id) {
    try {
      const userKeys = await pixKeysRepository.findAllByUser(currentUser.id);
      const defaultKey = userKeys.find((k) => k.isDefault) || userKeys[0];
      if (defaultKey?.chave) return { chave: defaultKey.chave, id: defaultKey.id };
    } catch (_err) {
      /* ignore */
    }
  }

  return { chave: DEFAULT_PIX_KEY, id: null };
}

class RechargeOrdersService {
  parseQuantity(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new AppError('Quantidade deve ser inteiro maior que zero', 400);
    }
    return parsed;
  }

  parseMoney(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new AppError('Valor monetário inválido', 400);
    }
    return Number(parsed.toFixed(2));
  }

  async createFromCart(payload, currentUser = null) {
    const rawItems = Array.isArray(payload?.items) ? payload.items : [];
    if (rawItems.length === 0) {
      throw new AppError('Carrinho vazio', 400);
    }
    if (rawItems.length > 50) {
      throw new AppError('Carrinho excede limite de 50 itens', 400);
    }

    const paymentMethod = payload?.paymentMethod === 'cripto' ? 'cripto' : 'pix';
    const requestedByPhone = payload?.requestedByPhone ? String(payload.requestedByPhone).trim() : null;

    let allowedCredentialIds = null;
    if (currentUser?.role === 'reseller' && currentUser?.clientId) {
      const creds = await credentialsRepository.findAll({ clientId: currentUser.clientId });
      allowedCredentialIds = new Set(creds.map((c) => c.id));
    }

    const resolvedItems = [];
    for (const raw of rawItems) {
      const credentialId = String(raw?.credentialId || '').trim();
      const serverId = String(raw?.serverId || '').trim();
      const accountLogin = String(raw?.accountLogin || '').trim();
      const quantity = this.parseQuantity(raw?.quantity);

      if (!credentialId) throw new AppError('Item sem credentialId', 400);
      if (!serverId) throw new AppError('Item sem serverId', 400);
      if (!accountLogin) throw new AppError('Item sem accountLogin', 400);

      if (allowedCredentialIds && !allowedCredentialIds.has(credentialId)) {
        throw new AppError('Credencial não pertence à revenda autenticada', 403);
      }

      const [credential, server] = await Promise.all([
        credentialsRepository.findById(credentialId),
        serversRepository.findById(serverId)
      ]);
      if (!credential) throw new AppError(`Credencial ${credentialId} não encontrada`, 400);
      if (!server) throw new AppError(`Servidor ${serverId} não encontrado`, 400);

      const pricing = await rechargeRequestsService.resolvePricing({
        credentialId,
        serverId,
        quantity
      });
      const totalAmount = this.parseMoney(pricing.unitPrice * quantity);

      resolvedItems.push({
        credentialId,
        serverId,
        accountLogin,
        quantity,
        unitPrice: pricing.unitPrice,
        totalAmount,
        isPromo: pricing.isPromo,
        promoUnitPrice: pricing.promoUnitPrice,
        catalogUnitPrice: pricing.catalogUnitPrice
      });
    }

    const totalAmount = this.parseMoney(
      resolvedItems.reduce((acc, item) => acc + item.totalAmount, 0)
    );

    const pix = await resolvePixForOrder(resolvedItems[0], currentUser);

    const clientId = currentUser?.clientId || null;
    const initialStatus = paymentMethod === 'pix' ? 'pix_gerado' : 'pendente_pagamento';

    const order = new RechargeOrderModel({
      createdByUserId: currentUser?.id || null,
      clientId,
      paymentMethod,
      paymentStatus: initialStatus,
      totalAmount,
      itemCount: resolvedItems.length,
      pixCode: paymentMethod === 'pix' ? pix.chave : null,
      pixTxid: null,
      pixKeyId: paymentMethod === 'pix' ? pix.id : null,
      requestedByPhone
    });

    await rechargeOrdersRepository.create(order, resolvedItems);
    return this.getById(order.id);
  }

  async getById(id) {
    const order = await rechargeOrdersRepository.findById(id);
    if (!order) throw new AppError('Pedido não encontrado', 404);

    const items = await rechargeOrdersRepository.findItemsByOrderId(id);
    const latestProof = await paymentProofsRepository.findLatestByOrderId(id);

    return {
      ...order,
      items,
      latestPaymentProof: latestProof || null
    };
  }

  async pageBundle({ clientId, limit, cursor, search, status, archived, requireProof = false } = {}) {
    const effectiveLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

    const rows = await rechargeOrdersRepository.findAllForListPage({
      clientId: clientId || null,
      limit: effectiveLimit,
      cursor,
      search,
      status,
      archived,
      requireProof
    });

    if (rows.length === 0) {
      return { rechargeOrders: [], nextCursor: null };
    }

    const ids = rows.map((r) => r.id);
    const [proofs, items] = await Promise.all([
      paymentProofsRepository.findLatestByOrderIds(ids),
      rechargeOrdersRepository.findItemsByOrderIds(ids)
    ]);
    const proofMap = new Map(proofs.map((p) => [p.rechargeOrderId, p]));
    const itemsByOrder = new Map();
    items.forEach((item) => {
      if (!itemsByOrder.has(item.orderId)) itemsByOrder.set(item.orderId, []);
      itemsByOrder.get(item.orderId).push(item);
    });

    const rechargeOrders = rows.map((row) => {
      const proof = proofMap.get(row.id);
      return {
        ...row,
        items: itemsByOrder.get(row.id) || [],
        latestPaymentProof: proof
          ? {
              id: proof.id,
              reviewStatus: proof.reviewStatus,
              caption: proof.caption ?? null,
              analysisSummary: proof.analysisSummary ?? null,
              analysisConfidence: proof.analysisConfidence ?? null,
              extractedAmount: proof.extractedAmount ?? null,
              matchesExpectedAmount: proof.matchesExpectedAmount ?? null,
              createdAt: proof.createdAt
            }
          : null
      };
    });

    const last = rows[rows.length - 1];
    const nextCursor =
      rows.length === effectiveLimit ? { createdAt: last.createdAt, id: last.id } : null;

    return { rechargeOrders, nextCursor };
  }

  async countPending(clientId = null, options = {}) {
    return rechargeOrdersRepository.countPending(clientId, options);
  }

  async approve(orderId) {
    const order = await rechargeOrdersRepository.findById(orderId);
    if (!order) throw new AppError('Pedido não encontrado', 404);
    if (order.paymentStatus === 'pago') return this.getById(orderId);

    // Only act on items still pending — skip ones already resolved item-by-item
    // (prevents double stock decrement / double sale notification).
    const allItems = await rechargeOrdersRepository.findItemsByOrderId(orderId);
    const pendingItems = allItems.filter(
      (it) => it.paymentStatus !== 'pago' && it.paymentStatus !== 'cancelado'
    );

    await Promise.all(
      pendingItems.map((it) => rechargeOrdersRepository.updateItemPaymentStatus(it.id, 'pago'))
    );

    await Promise.allSettled(
      pendingItems.map(async (item) => {
        try {
          await serversRepository.decrementStock(item.serverId, item.quantity);
        } catch (error) {
          console.error(`Falha ao decrementar estoque item ${item.id}:`, error);
        }
      })
    );

    const results = await Promise.allSettled(
      pendingItems.map((item) =>
        salesNotificationsService.processPaidRecharge({ ...item, paymentStatus: 'pago' })
      )
    );
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`Falha ao notificar venda do item ${pendingItems[i].id}:`, r.reason);
      }
    });

    await this._syncOrderStatusFromItems(orderId);
    return this.getById(orderId);
  }

  async reject(orderId, currentUser = null) {
    const order = await rechargeOrdersRepository.findById(orderId);
    if (!order) throw new AppError('Pedido não encontrado', 404);
    if (order.paymentStatus === 'cancelado') return this.getById(orderId);
    if (order.paymentStatus === 'pago') {
      throw new AppError('Pedido pago não pode ser rejeitado', 400);
    }

    // Cancel only items still pending — leave any item already paid item-by-item intact.
    const allItems = await rechargeOrdersRepository.findItemsByOrderId(orderId);
    const pendingItems = allItems.filter(
      (it) => it.paymentStatus !== 'pago' && it.paymentStatus !== 'cancelado'
    );

    await Promise.all(
      pendingItems.map((it) => rechargeOrdersRepository.updateItemPaymentStatus(it.id, 'cancelado'))
    );

    await Promise.allSettled(
      pendingItems.map((item) =>
        rechargeCancellationNotificationsService.notifyCancelled({
          recharge: { ...item, paymentStatus: 'cancelado' },
          cancelledBy: currentUser
        })
      )
    );

    await this._syncOrderStatusFromItems(orderId);
    return this.getById(orderId);
  }

  async _syncOrderStatusFromItems(orderId) {
    const items = await rechargeOrdersRepository.findItemsByOrderId(orderId);
    if (items.length === 0) return;

    const allResolved = items.every(
      (it) => it.paymentStatus === 'pago' || it.paymentStatus === 'cancelado'
    );
    if (!allResolved) return;

    const anyPaid = items.some((it) => it.paymentStatus === 'pago');
    const nextStatus = anyPaid ? 'pago' : 'cancelado';

    const order = await rechargeOrdersRepository.findById(orderId);
    if (!order || order.paymentStatus === nextStatus) return;
    await rechargeOrdersRepository.updatePayment(orderId, { paymentStatus: nextStatus });
  }

  async approveItem(orderId, itemId, currentUser = null) {
    const order = await rechargeOrdersRepository.findById(orderId);
    if (!order) throw new AppError('Pedido não encontrado', 404);

    const item = await rechargeOrdersRepository.findItemById(itemId);
    if (!item || item.orderId !== orderId) {
      throw new AppError('Item do pedido não encontrado', 404);
    }
    if (item.paymentStatus === 'pago') return this.getById(orderId);
    if (item.paymentStatus === 'cancelado') {
      throw new AppError('Item cancelado não pode ser aprovado', 400);
    }

    await rechargeOrdersRepository.updateItemPaymentStatus(itemId, 'pago');

    try {
      await serversRepository.decrementStock(item.serverId, item.quantity);
    } catch (error) {
      console.error(`Falha ao decrementar estoque item ${item.id}:`, error);
    }

    try {
      await salesNotificationsService.processPaidRecharge({ ...item, paymentStatus: 'pago' });
    } catch (error) {
      console.error(`Falha ao notificar venda do item ${item.id}:`, error);
    }

    await this._syncOrderStatusFromItems(orderId);
    return this.getById(orderId);
  }

  async rejectItem(orderId, itemId, currentUser = null) {
    const order = await rechargeOrdersRepository.findById(orderId);
    if (!order) throw new AppError('Pedido não encontrado', 404);

    const item = await rechargeOrdersRepository.findItemById(itemId);
    if (!item || item.orderId !== orderId) {
      throw new AppError('Item do pedido não encontrado', 404);
    }
    if (item.paymentStatus === 'cancelado') return this.getById(orderId);
    if (item.paymentStatus === 'pago') {
      throw new AppError('Item pago não pode ser rejeitado', 400);
    }

    await rechargeOrdersRepository.updateItemPaymentStatus(itemId, 'cancelado');

    try {
      await rechargeCancellationNotificationsService.notifyCancelled({
        recharge: { ...item, paymentStatus: 'cancelado' },
        cancelledBy: currentUser
      });
    } catch (error) {
      console.error(`Falha ao notificar cancelamento do item ${item.id}:`, error);
    }

    await this._syncOrderStatusFromItems(orderId);
    return this.getById(orderId);
  }

  async cancelByOwner(orderId, currentUser = null) {
    const existing = await this.getById(orderId);
    if (existing.paymentStatus === 'cancelado') return existing;
    if (existing.paymentStatus === 'pago') {
      throw new AppError('Pedido pago não pode ser cancelado', 400);
    }
    if (existing.latestPaymentProof) {
      throw new AppError('Pedido com comprovante enviado não pode ser cancelado', 400);
    }
    return this.reject(orderId, currentUser);
  }

  async archive(id) {
    const existing = await rechargeOrdersRepository.findById(id);
    if (!existing) throw new AppError('Pedido não encontrado', 404);
    return rechargeOrdersRepository.archive(id);
  }
}

module.exports = new RechargeOrdersService();
