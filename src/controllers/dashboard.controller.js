const dashboardService = require('../services/dashboard.service');

class DashboardController {
  async summary(_req, res) {
    const data = await dashboardService.summary();
    return res.status(200).json(data);
  }

  async resellersRanking(req, res) {
    const { period, limit } = req.query || {};
    const data = await dashboardService.resellersRanking({ period, limit });
    return res.status(200).json(data);
  }

  async serversRanking(req, res) {
    const { period, limit } = req.query || {};
    const data = await dashboardService.serversRanking({ period, limit });
    return res.status(200).json(data);
  }

  async resellerDetails(req, res) {
    const { clientId } = req.params || {};
    const { period } = req.query || {};
    const data = await dashboardService.resellerDetails({ clientId, period });
    return res.status(200).json(data);
  }

  async finances(req, res) {
    const { period, month } = req.query || {};
    const data = await dashboardService.finances({ period, month });
    return res.status(200).json(data);
  }

  async financeServerOrders(req, res) {
    const { serverId } = req.params || {};
    const { period, month } = req.query || {};
    const data = await dashboardService.financeServerOrders({ serverId, period, month });
    return res.status(200).json(data);
  }

  async page(_req, res) {
    const data = await dashboardService.pageBundle();
    return res.status(200).json(data);
  }

  async ranking(req, res) {
    const { period, limit } = req.query || {};
    const data = await dashboardService.rankingPage({ period, limit });
    return res.status(200).json(data);
  }
}

module.exports = new DashboardController();
