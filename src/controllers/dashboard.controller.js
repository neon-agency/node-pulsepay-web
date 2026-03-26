const dashboardService = require('../services/dashboard.service');

class DashboardController {
  async summary(_req, res) {
    const data = await dashboardService.summary();
    return res.status(200).json(data);
  }
}

module.exports = new DashboardController();
