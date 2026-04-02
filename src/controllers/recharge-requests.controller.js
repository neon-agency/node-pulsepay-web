const rechargeRequestsService = require('../services/recharge-requests.service');

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
}

module.exports = new RechargeRequestsController();
