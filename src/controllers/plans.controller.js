const plansService = require('../services/plans.service');

class PlansController {
  async list(_req, res) {
    const plans = await plansService.listActive();
    return res.status(200).json(plans);
  }
}

module.exports = new PlansController();

