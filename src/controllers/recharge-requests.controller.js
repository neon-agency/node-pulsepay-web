const rechargeRequestsService = require('../services/recharge-requests.service');
const paymentProofsService = require('../services/payment-proofs.service');
const credentialsRepository = require('../repositories/credentials.repository');
const pixKeysService = require('../services/pix-keys.service');
const AppError = require('../errors/app-error');

const DEFAULT_PIX_KEY = process.env.PIX_KEY || 'b0944752-7136-49ef-920a-0d21a3aa4be5';

async function resolvePixForRecharge(data) {
  const resolved = await pixKeysService.resolvePixKeyForLink(data.credentialId, data.serverId);
  return resolved?.chave || DEFAULT_PIX_KEY;
}

async function getResellerCredentialIds(clientId) {
  if (!clientId) return [];
  const creds = await credentialsRepository.findAll({ clientId });
  return creds.map((credential) => credential.id);
}

async function ensureRechargeAccess(req, rechargeRequestId) {
  const data = await rechargeRequestsService.getById(rechargeRequestId);

  if (req.user?.type === 'internal' || req.user?.role === 'admin') {
    return data;
  }

  if (req.user?.role !== 'reseller' || !req.user?.clientId) {
    throw new AppError('Acesso negado', 403);
  }

  const allowedCredentialIds = await getResellerCredentialIds(req.user.clientId);
  if (!allowedCredentialIds.includes(data.credentialId)) {
    throw new AppError('Acesso negado', 403);
  }

  return data;
}

class RechargeRequestsController {
  async list(req, res) {
    let credentialIds = null;

    if (req.user?.role === 'reseller' && req.user?.clientId) {
      credentialIds = await getResellerCredentialIds(req.user.clientId);
      if (credentialIds.length === 0) {
        return res.status(200).json([]);
      }
    } else if (req.query?.credentialId) {
      credentialIds = [String(req.query.credentialId)];
    }

    const data = await rechargeRequestsService.list({ credentialIds });
    return res.status(200).json(data);
  }

  async getById(req, res) {
    const data = await ensureRechargeAccess(req, req.params.id);
    return res.status(200).json(data);
  }

  async create(req, res) {
    if (req.user?.role === 'reseller' && req.user?.clientId) {
      const credentialId = String(req.body?.credentialId || '').trim();
      const credential = await credentialsRepository.findById(credentialId);

      if (!credential || credential.clientId !== req.user.clientId) {
        throw new AppError('Credencial não pertence à revenda autenticada', 403);
      }
    }

    let data = await rechargeRequestsService.create(req.body || {}, req.user || null);

    if (req.user?.role === 'reseller') {
      const pixKey = await resolvePixForRecharge(data);
      data = await rechargeRequestsService.updatePayment(data.id, {
        paymentStatus: 'pix_gerado',
        paymentMethod: 'pix',
        pixCode: pixKey,
        pixTxid: null
      });
    }

    return res.status(201).json(data);
  }

  async updatePayment(req, res) {
    if (req.user?.type !== 'internal' && req.user?.role !== 'admin') {
      throw new AppError('Acesso negado', 403);
    }

    const data = await rechargeRequestsService.updatePayment(req.params.id, req.body || {});
    return res.status(200).json(data);
  }

  async getLatestPaymentProof(req, res) {
    await ensureRechargeAccess(req, req.params.id);
    const data = await paymentProofsService.getLatestByRechargeRequestId(req.params.id);
    return res.status(200).json(data);
  }

  async uploadPaymentProof(req, res) {
    await ensureRechargeAccess(req, req.params.id);

    const data = await paymentProofsService.createFromWebUpload({
      rechargeRequestId: req.params.id,
      user: req.user || null,
      fileName: req.body?.fileName,
      mimeType: req.body?.mimeType,
      contentBase64: req.body?.contentBase64,
      comment: req.body?.comment
    });

    return res.status(201).json(data);
  }

  async reviewLatestPaymentProof(req, res) {
    if (req.user?.type !== 'internal' && req.user?.role !== 'admin') {
      throw new AppError('Acesso negado', 403);
    }

    const data = await paymentProofsService.reviewLatest({
      rechargeRequestId: req.params.id,
      reviewedByUserId: req.user?.id || null,
      decision: req.body?.decision,
      reviewerNotes: req.body?.reviewerNotes
    });
    return res.status(200).json(data);
  }

  async downloadLatestPaymentProofFile(req, res) {
    await ensureRechargeAccess(req, req.params.id);
    const file = await paymentProofsService.downloadProofFile(req.params.id);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    return res.status(200).send(file.buffer);
  }

  async archive(req, res) {
    if (req.user?.type !== 'internal' && req.user?.role !== 'admin') {
      throw new AppError('Acesso negado', 403);
    }
    const data = await rechargeRequestsService.archive(req.params.id);
    return res.status(200).json(data);
  }

  async cancel(req, res) {
    await ensureRechargeAccess(req, req.params.id);
    const data = await rechargeRequestsService.cancel(req.params.id, req.user || null);
    return res.status(200).json(data);
  }
}

module.exports = new RechargeRequestsController();
