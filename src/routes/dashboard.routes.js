const { Router } = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const asyncHandler = require('../utils/async-handler');
const requireRole = require('../middlewares/require-role.middleware');

const dashboardRoutes = Router();

dashboardRoutes.get('/', asyncHandler((req, res) => dashboardController.summary(req, res)));
dashboardRoutes.get('/page', asyncHandler((req, res) => dashboardController.page(req, res)));
dashboardRoutes.get('/ranking', asyncHandler((req, res) => dashboardController.ranking(req, res)));
dashboardRoutes.get(
  '/resellers-ranking',
  asyncHandler((req, res) => dashboardController.resellersRanking(req, res))
);
dashboardRoutes.get(
  '/resellers-ranking/:clientId/details',
  asyncHandler((req, res) => dashboardController.resellerDetails(req, res))
);
dashboardRoutes.get(
  '/servers-ranking',
  asyncHandler((req, res) => dashboardController.serversRanking(req, res))
);
dashboardRoutes.get(
  '/finances',
  asyncHandler((req, res) => dashboardController.finances(req, res))
);
// Per-order detail exposes reseller names + account logins, so lock it to admins
// (internal bypasses requireRole). Resellers must never enumerate other clients' orders.
dashboardRoutes.get(
  '/finances/server/:serverId',
  requireRole('admin'),
  asyncHandler((req, res) => dashboardController.financeServerOrders(req, res))
);

module.exports = dashboardRoutes;
