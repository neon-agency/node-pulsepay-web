const { Router } = require('express');
const plansController = require('../controllers/plans.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const plansRoutes = Router();

plansRoutes.get('/', authMiddleware, asyncHandler((req, res) => plansController.list(req, res)));

module.exports = plansRoutes;

