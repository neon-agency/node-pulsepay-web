const { Router } = require('express');
const asyncHandler = require('../utils/async-handler');
const plansService = require('../services/plans.service');

const publicRoutes = Router();

publicRoutes.get('/plans', asyncHandler(async (_req, res) => {
  const plans = await plansService.listActive();
  return res.status(200).json(plans);
}));

module.exports = publicRoutes;

