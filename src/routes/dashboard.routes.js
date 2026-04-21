const { Router } = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const asyncHandler = require('../utils/async-handler');

const dashboardRoutes = Router();

dashboardRoutes.get('/', asyncHandler((req, res) => dashboardController.summary(req, res)));
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

module.exports = dashboardRoutes;
