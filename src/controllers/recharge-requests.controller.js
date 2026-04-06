const rechargeRequestsService = require('../services/recharge-requests.service');
const paymentProofsService = require('../services/payment-proofs.service');

class RechargeRequestsController {
  async list(_req, res) {
    const data = await rechargeRequestsService.list();
    return res.status(200).json(data);
  }

  async getById(req, res) {
    const data = await rechargeRequestsService.getById(req.params.id);
    return res.status(200).json(data);
  }

  async create(req, res) {
    const data = await rechargeRequestsService.create(req.body || {}, req.user || null);
    return res.status(201).json(data);
  }

  async updatePayment(req, res) {
    const data = await rechargeRequestsService.updatePayment(req.params.id, req.body || {});
    return res.status(200).json(data);
  }

  async getLatestPaymentProof(req, res) {
    const data = await paymentProofsService.getLatestByRechargeRequestId(req.params.id);
    return res.status(200).json(data);
  }

  async reviewLatestPaymentProof(req, res) {
    const data = await paymentProofsService.reviewLatest({
      rechargeRequestId: req.params.id,
      reviewedByUserId: req.user?.id || null,
      decision: req.body?.decision,
      reviewerNotes: req.body?.reviewerNotes
    });
    return res.status(200).json(data);
  }

  async downloadLatestPaymentProofFile(req, res) {
    const file = await paymentProofsService.downloadProofFile(req.params.id);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    return res.status(200).send(file.buffer);
  }
}

module.exports = new RechargeRequestsController();
