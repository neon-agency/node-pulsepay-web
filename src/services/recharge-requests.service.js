const AppError = require('../errors/app-error');
const RechargeRequestModel = require('../models/recharge-request.model');
const credentialServersRepository = require('../repositories/credential-servers.repository');
const credentialsRepository = require('../repositories/credentials.repository');
const serversRepository = require('../repositories/servers.repository');
const rechargeRequestsRepository = require('../repositories/recharge-requests.repository');

class RechargeRequestsService {
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

  async list() {
    return rechargeRequestsRepository.findAll();
  }

  async getById(id) {
    const row = await rechargeRequestsRepository.findById(id);
    if (!row) throw new AppError('Solicitação de recarga não encontrada', 404);
    return row;
  }

  async resolvePrice({ credentialId, serverId, unitPrice }) {
    if (unitPrice !== undefined && unitPrice !== null) {
      return this.parseMoney(unitPrice);
    }

    const link = await credentialServersRepository.findOneByCredentialAndServer(credentialId, serverId);
    if (!link || !link.isActive) {
      throw new AppError('Credencial não está vinculada ao servidor informado', 400);
    }

    const effectivePrice = link.priceOverride === null ? link.basePrice : link.priceOverride;
    return this.parseMoney(effectivePrice);
  }

  async create(payload) {
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
      unitPrice: payload?.unitPrice
    });
    const totalAmount = this.parseMoney(unitPrice * quantity);

    const created = await rechargeRequestsRepository.create(new RechargeRequestModel({
      credentialId,
      serverId,
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
    await this.getById(id);

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

    return this.getById(id);
  }
}

module.exports = new RechargeRequestsService();
