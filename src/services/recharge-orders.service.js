const AppError = require('../errors/app-error');
const RechargeOrderModel = require('../models/recharge-order.model');
const rechargeOrdersRepository = require('../repositories/recharge-orders.repository');
const rechargeRequestsService = require('./recharge-requests.service');
const credentialsRepository = require('../repositories/credentials.repository');
const serversRepository = require('../repositories/servers.repository');
const paymentProofsRepository = require('../repositories/recharge-request-payment-proofs.repository');
const pixKeysService = require('./pix-keys.service');
const pixKeysRepository = require('../repositories/pix-keys.repository');

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

    const order = new RechargeOrderModel({
      createdByUserId: currentUser?.id || null,
      clientId,
      paymentMethod,
      status: 'SOLICITADO',
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
              reviewedAt: proof.reviewedAt ?? null,
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

  // Marcador de execucao do item (toggle). Nao mexe em estoque — o estoque so e
  // debitado quando o PEDIDO e concluido.
  async setItemExecution(orderId, itemId, executed) {
    const order = await rechargeOrdersRepository.findById(orderId);
    if (!order) throw new AppError('Pedido não encontrado', 404);
    if (this._isTerminal(order.status)) {
      throw new AppError('Pedido finalizado não pode ter itens alterados', 400);
    }

    const item = await rechargeOrdersRepository.findItemById(itemId);
    if (!item || item.orderId !== orderId) {
      throw new AppError('Item do pedido não encontrado', 404);
    }

    const next = executed ? 'REALIZADO' : 'NAO_REALIZADO';
    if (item.executionStatus !== next) {
      await rechargeOrdersRepository.updateItemExecutionStatus(itemId, next);
    }
    return this.getById(orderId);
  }

  _isTerminal(status) {
    return status === 'CONCLUIDO' || status === 'CANCELADO';
  }

  // Transicoes validas do pedido. CONCLUIDO depende da trava (todos REALIZADO).
  _allowedTransitions(from) {
    switch (from) {
      case 'SOLICITADO':
        return ['EM_ESPERA', 'CANCELADO', 'CONCLUIDO'];
      case 'EM_ESPERA':
        // Permite concluir direto um pedido pausado (os itens continuam
        // editáveis em EM_ESPERA), além de retomar/cancelar.
        return ['SOLICITADO', 'CANCELADO', 'CONCLUIDO'];
      default:
        return [];
    }
  }

  async transitionStatus(orderId, target) {
    const valid = ['SOLICITADO', 'EM_ESPERA', 'CONCLUIDO', 'CANCELADO'];
    if (!valid.includes(target)) {
      throw new AppError('Status inválido', 400);
    }

    const order = await rechargeOrdersRepository.findById(orderId);
    if (!order) throw new AppError('Pedido não encontrado', 404);
    if (order.status === target) return this.getById(orderId);

    if (!this._allowedTransitions(order.status).includes(target)) {
      throw new AppError(`Transição inválida: ${order.status} → ${target}`, 400);
    }

    if (target === 'CONCLUIDO') {
      const items = await rechargeOrdersRepository.findItemsByOrderId(orderId);
      if (items.length === 0) {
        throw new AppError('Pedido sem itens não pode ser concluído', 400);
      }
      const pending = items.filter((it) => it.executionStatus !== 'REALIZADO');
      if (pending.length > 0) {
        throw new AppError(
          `Conclua todos os itens antes: ${items.length - pending.length}/${items.length} realizados`,
          400
        );
      }

      // Debita estoque de todos os itens uma unica vez (CONCLUIDO e terminal).
      await Promise.allSettled(
        items.map(async (item) => {
          try {
            await serversRepository.decrementStock(item.serverId, item.quantity);
          } catch (error) {
            console.error(`Falha ao decrementar estoque item ${item.id}:`, error);
          }
        })
      );
    }

    await rechargeOrdersRepository.updateOrderStatus(orderId, target);
    return this.getById(orderId);
  }

  async cancelByOwner(orderId, currentUser = null) {
    const existing = await rechargeOrdersRepository.findById(orderId);
    if (!existing) throw new AppError('Pedido não encontrado', 404);
    if (existing.status === 'CANCELADO') return this.getById(orderId);
    if (this._isTerminal(existing.status)) {
      throw new AppError('Pedido finalizado não pode ser cancelado', 400);
    }
    return this.transitionStatus(orderId, 'CANCELADO');
  }

  async archive(id) {
    const existing = await rechargeOrdersRepository.findById(id);
    if (!existing) throw new AppError('Pedido não encontrado', 404);
    return rechargeOrdersRepository.archive(id);
  }

  async delete(id) {
    const existing = await rechargeOrdersRepository.findById(id);
    if (!existing) {
      throw new AppError('Pedido não encontrado', 404);
    }
    if (existing.status === 'CONCLUIDO') {
      throw new AppError('Pedido concluído não pode ser excluído', 400);
    }
    // Itens (linhas em recharge_requests com order_id) somem via FK onDelete CASCADE.
    await rechargeOrdersRepository.deleteById(id);
    return { id };
  }
}

module.exports = new RechargeOrdersService();
