const AppError = require('../errors/app-error');
const RechargeRequestModel = require('../models/recharge-request.model');
const credentialServersRepository = require('../repositories/credential-servers.repository');
const credentialsRepository = require('../repositories/credentials.repository');
const serversRepository = require('../repositories/servers.repository');
const rechargeRequestsRepository = require('../repositories/recharge-requests.repository');
const paymentProofsRepository = require('../repositories/recharge-request-payment-proofs.repository');

class RechargeRequestsService {
  resolveCatalogPricing(link, quantity) {
    const sortedServerTiers = [...(link?.serverPriceTiers || [])].sort((a, b) => a.quantity - b.quantity);
    if (sortedServerTiers.length === 0) {
      return { effectiveUnit: null, catalogUnit: null, promoUnit: null, isPromo: false };
    }

    const overrideByQuantity = new Map(
      (link?.priceTiersOverride || []).map((tier) => [tier.quantity, tier.unitPrice])
    );
    const promoActive = Boolean(link?.serverPromoActive);
    const promoByQuantity = new Map(
      (link?.serverPromoPriceTiers || []).map((tier) => [tier.quantity, tier.unitPrice])
    );

    const pickTier = () => {
      const exact = sortedServerTiers.find((tier) => tier.quantity === quantity);
      if (exact) return exact;
      const gap = [...sortedServerTiers].reverse().find((tier) => tier.quantity <= quantity);
      return gap ?? sortedServerTiers[0];
    };

    const tier = pickTier();
    const catalogUnit = overrideByQuantity.get(tier.quantity) ?? tier.unitPrice;
    const promoUnit = promoByQuantity.get(tier.quantity) ?? null;
    const isPromo = promoActive && promoUnit !== null;
    const effectiveUnit = isPromo ? promoUnit : catalogUnit;

    return { effectiveUnit, catalogUnit, promoUnit, isPromo };
  }

  resolveCatalogUnitPrice(link, quantity) {
    return this.resolveCatalogPricing(link, quantity).effectiveUnit;
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

  async list({ credentialIds, requireProof = false } = {}) {
    const rows = await rechargeRequestsRepository.findAll({
      credentialIds: credentialIds || null,
      requireProof
    });
    return this.enrichWithPaymentProof(rows);
  }

  async countPending({ credentialIds } = {}) {
    const db = require('../database/knex');
    const query = db('recharge_requests as rr')
      .innerJoin('recharge_request_payment_proofs as p', 'p.recharge_request_id', 'rr.id')
      .where('p.review_status', 'pending_review')
      .where('rr.archived', false);
    if (Array.isArray(credentialIds) && credentialIds.length) {
      query.whereIn('rr.credential_id', credentialIds);
    }
    const result = await query.countDistinct({ count: 'rr.id' }).first();
    return Number(result?.count || 0);
  }

  async pageBundle({
    credentialIds,
    limit,
    cursor,
    search,
    status,
    archived,
    requireProof = false
  } = {}) {
    const effectiveLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

    const rows = await rechargeRequestsRepository.findAllForListPage({
      credentialIds: credentialIds || null,
      limit: effectiveLimit,
      cursor,
      search,
      status,
      archived,
      requireProof
    });

    if (rows.length === 0) {
      return { rechargeRequests: [], nextCursor: null };
    }

    const proofs = await paymentProofsRepository.findLatestByRechargeRequestIds(
      rows.map((row) => row.id)
    );
    const proofMap = new Map(proofs.map((proof) => [proof.rechargeRequestId, proof]));

    const rechargeRequests = rows.map((row) => {
      const proof = proofMap.get(row.id);
      return {
        ...row,
        latestPaymentProof: proof
          ? {
              id: proof.id,
              reviewStatus: proof.reviewStatus,
              reviewedAt: proof.reviewedAt ?? null,
              caption: proof.caption ?? null,
              analysisSummary: proof.analysisSummary ?? null,
              analysisConfidence: proof.analysisConfidence ?? null,
              createdAt: proof.createdAt
            }
          : null
      };
    });

    const last = rows[rows.length - 1];
    const nextCursor =
      rows.length === effectiveLimit
        ? { createdAt: last.createdAt, id: last.id }
        : null;

    return { rechargeRequests, nextCursor };
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

  async resolvePricing({ credentialId, serverId, quantity, unitPrice }) {
    if (unitPrice !== undefined && unitPrice !== null) {
      return {
        unitPrice: this.parseMoney(unitPrice),
        isPromo: false,
        promoUnitPrice: null,
        catalogUnitPrice: null
      };
    }

    const link = await credentialServersRepository.findOneByCredentialAndServer(credentialId, serverId);
    if (!link || !link.isActive) {
      throw new AppError('Credencial não está vinculada ao servidor informado', 400);
    }

    if (link.priceOverride !== null) {
      return {
        unitPrice: this.parseMoney(link.priceOverride),
        isPromo: false,
        promoUnitPrice: null,
        catalogUnitPrice: this.parseMoney(link.priceOverride)
      };
    }

    const pricing = this.resolveCatalogPricing(link, quantity);
    if (pricing.effectiveUnit !== null) {
      return {
        unitPrice: this.parseMoney(pricing.effectiveUnit),
        isPromo: pricing.isPromo,
        promoUnitPrice: pricing.promoUnit !== null ? this.parseMoney(pricing.promoUnit) : null,
        catalogUnitPrice: pricing.catalogUnit !== null ? this.parseMoney(pricing.catalogUnit) : null
      };
    }

    const fallback = link.basePrice;
    return {
      unitPrice: this.parseMoney(fallback),
      isPromo: false,
      promoUnitPrice: null,
      catalogUnitPrice: this.parseMoney(fallback)
    };
  }

  async resolvePrice(args) {
    const { unitPrice } = await this.resolvePricing(args);
    return unitPrice;
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

    const pricing = await this.resolvePricing({
      credentialId,
      serverId,
      quantity,
      unitPrice: payload?.unitPrice
    });
    const totalAmount = this.parseMoney(pricing.unitPrice * quantity);

    const created = await rechargeRequestsRepository.create(new RechargeRequestModel({
      credentialId,
      serverId,
      createdByUserId: currentUser?.id || null,
      accountLogin,
      quantity,
      unitPrice: pricing.unitPrice,
      totalAmount,
      paymentMethod,
      paymentStatus: 'pendente_pagamento',
      requestedByPhone,
      isPromo: pricing.isPromo,
      promoUnitPrice: pricing.promoUnitPrice,
      catalogUnitPrice: pricing.catalogUnitPrice
    }));

    return this.getById(created.id);
  }

  async updatePayment(id, payload) {
    const previous = await this.getById(id);

    const nextStatus = String(payload?.paymentStatus || '').trim();
    const allowed = ['pendente_pagamento', 'pix_gerado', 'pago', 'sem_creditos', 'cancelado'];
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

  async delete(id) {
    const existing = await rechargeRequestsRepository.findById(id);
    if (!existing) {
      throw new AppError('Solicitação não encontrada', 404);
    }
    if (existing.paymentStatus === 'pago') {
      throw new AppError('Solicitação paga não pode ser excluída', 400);
    }
    await rechargeRequestsRepository.deleteById(id);
    return { id };
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

    return updated;
  }
}

module.exports = new RechargeRequestsService();
