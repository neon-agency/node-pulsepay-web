const AppError = require('../errors/app-error');
const RechargeRequestModel = require('../models/recharge-request.model');
const credentialServersRepository = require('../repositories/credential-servers.repository');
const credentialsRepository = require('../repositories/credentials.repository');
const serversRepository = require('../repositories/servers.repository');
const rechargeRequestsRepository = require('../repositories/recharge-requests.repository');
const paymentProofsRepository = require('../repositories/recharge-request-payment-proofs.repository');
const salesNotificationsService = require('./sales-notifications.service');
const rechargeCancellationNotificationsService = require('./recharge-cancellation-notifications.service');

class RechargeRequestsService {
  resolveCatalogUnitPrice(link, quantity) {
    const sortedServerTiers = [...(link?.serverPriceTiers || [])].sort((a, b) => a.quantity - b.quantity);
    const overrideByQuantity = new Map(
      (link?.priceTiersOverride || []).map((tier) => [tier.quantity, tier.unitPrice])
    );

    const effectiveTiers = sortedServerTiers.map((tier) => ({
      quantity: tier.quantity,
      unitPrice: overrideByQuantity.get(tier.quantity) ?? tier.unitPrice
    }));

    if (effectiveTiers.length === 0) {
      return null;
    }

    const exactTier = effectiveTiers.find((tier) => tier.quantity === quantity);
    if (exactTier) return exactTier.unitPrice;

    const gapTier = [...effectiveTiers].reverse().find((tier) => tier.quantity <= quantity);
    if (gapTier) return gapTier.unitPrice;

    return effectiveTiers[0].unitPrice;
  }

  parseQuantity(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new AppError('Quantidade deve ser um inteiro maior que zero', 400);
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

  async list({ credentialIds } = {}) {
    const rows = await rechargeRequestsRepository.findAll({ credentialIds: credentialIds || null });
    return this.enrichWithPaymentProof(rows);
  }

  async pageBundle({ credentialIds } = {}) {
    const [rechargeRequests, servers] = await Promise.all([
      this.list({ credentialIds: credentialIds || null }),
      serversRepository.findAll()
    ]);
    return { rechargeRequests, servers };
  }

  async getById(id) {
    const row = await rechargeRequestsRepository.findById(id);
    if (!row) throw new AppError('Solicitação de recarga não encontrada', 404);
    const [enriched] = await this.enrichWithPaymentProof([row]);
    return enriched;
  }

  async enrichWithPaymentProof(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    const proofs = await paymentProofsRepository.findLatestByRechargeRequestIds(rows.map((row) => row.id));
    const proofMap = new Map(proofs.map((proof) => [proof.rechargeRequestId, proof]));

    return rows.map((row) => ({
      ...row,
      latestPaymentProof: proofMap.get(row.id) || null
    }));
  }

  async resolvePrice({ credentialId, serverId, quantity, unitPrice }) {
    if (unitPrice !== undefined && unitPrice !== null) {
      return this.parseMoney(unitPrice);
    }

    const link = await credentialServersRepository.findOneByCredentialAndServer(credentialId, serverId);
    if (!link || !link.isActive) {
      throw new AppError('Credencial não está vinculada ao servidor informado', 400);
    }

    if (link.priceOverride !== null) {
      return this.parseMoney(link.priceOverride);
    }

    const catalogUnitPrice = this.resolveCatalogUnitPrice(link, quantity);
    if (catalogUnitPrice !== null) {
      return this.parseMoney(catalogUnitPrice);
    }

    const effectivePrice = link.priceOverride === null ? link.basePrice : link.priceOverride;
    return this.parseMoney(effectivePrice);
  }

  async create(payload, currentUser = null) {
    const credentialId = String(payload?.credentialId || '').trim();
    const serverId = String(payload?.serverId || '').trim();
    const accountLogin = String(payload?.accountLogin || '').trim();
    const quantity = this.parseQuantity(payload?.quantity);
    const paymentMethod = payload?.paymentMethod === 'cripto' ? 'cripto' : 'pix';
    const requestedByPhone = payload?.requestedByPhone ? String(payload.requestedByPhone).trim() : null;

    if (!credentialId) throw new AppError('Campo "credentialId" é obrigatório', 400);
    if (!serverId) throw new AppError('Campo "serverId" é obrigatório', 400);
    if (!accountLogin) throw new AppError('Campo "accountLogin" é obrigatório', 400);

    const [credential, server] = await Promise.all([
      credentialsRepository.findById(credentialId),
      serversRepository.findById(serverId)
    ]);

    if (!credential) throw new AppError('Credencial não encontrada', 400);
    if (!server) throw new AppError('Servidor não encontrado', 400);

    const unitPrice = await this.resolvePrice({
      credentialId,
      serverId,
      quantity,
      unitPrice: payload?.unitPrice
    });
    const totalAmount = this.parseMoney(unitPrice * quantity);

    const created = await rechargeRequestsRepository.create(new RechargeRequestModel({
      credentialId,
      serverId,
      createdByUserId: currentUser?.id || null,
      accountLogin,
      quantity,
      unitPrice,
      totalAmount,
      paymentMethod,
      paymentStatus: 'pendente_pagamento',
      requestedByPhone
    }));

    return this.getById(created.id);
  }

  async updatePayment(id, payload) {
    const previous = await this.getById(id);

    const nextStatus = String(payload?.paymentStatus || '').trim();
    const allowed = ['pendente_pagamento', 'pix_gerado', 'pago', 'cancelado'];
    if (!allowed.includes(nextStatus)) {
      throw new AppError('paymentStatus inválido', 400);
    }

    const paymentMethod = payload?.paymentMethod
      ? String(payload.paymentMethod).trim().toLowerCase()
      : undefined;

    if (paymentMethod && !['pix', 'cripto'].includes(paymentMethod)) {
      throw new AppError('paymentMethod inválido', 400);
    }

    await rechargeRequestsRepository.updatePayment(id, {
      paymentStatus: nextStatus,
      paymentMethod,
      pixCode: payload?.pixCode ? String(payload.pixCode) : null,
      pixTxid: payload?.pixTxid ? String(payload.pixTxid) : null
    });

    const updated = await this.getById(id);

    if (previous.paymentStatus !== 'pago' && updated.paymentStatus === 'pago') {
      if (updated.serverId && updated.quantity) {
        try {
          await serversRepository.decrementStock(updated.serverId, updated.quantity);
        } catch (error) {
          console.error('Falha ao decrementar estoque do servidor:', error);
        }
      }
      await salesNotificationsService.processPaidRecharge(updated);
    }

    return updated;
  }

  async archive(id) {
    const existing = await rechargeRequestsRepository.findById(id);
    if (!existing) {
      throw new AppError('Solicitação não encontrada', 404);
    }
    return rechargeRequestsRepository.archive(id);
  }

  async cancel(id, currentUser = null) {
    const existing = await this.getById(id);

    if (existing.paymentStatus === 'cancelado') {
      return existing;
    }

    if (existing.paymentStatus === 'pago') {
      throw new AppError('Solicitação paga não pode ser cancelada', 400);
    }

    if (existing.latestPaymentProof) {
      throw new AppError('Solicitação com comprovante enviado não pode ser cancelada', 400);
    }

    await rechargeRequestsRepository.updatePayment(id, {
      paymentStatus: 'cancelado',
      paymentMethod: existing.paymentMethod,
      pixCode: existing.pixCode,
      pixTxid: existing.pixTxid
    });

    const updated = await this.getById(id);

    try {
      await rechargeCancellationNotificationsService.notifyCancelled({
        recharge: updated,
        cancelledBy: currentUser
      });
    } catch (error) {
      console.error('Falha ao notificar cancelamento de solicitação:', error);
    }

    return updated;
  }
}

module.exports = new RechargeRequestsService();
