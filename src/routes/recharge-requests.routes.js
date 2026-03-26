const { Router } = require('express');
const rechargeRequestsController = require('../controllers/recharge-requests.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const rechargeRequestsRoutes = Router();

rechargeRequestsRoutes.get('/', authMiddleware, asyncHandler((req, res) => rechargeRequestsController.list(req, res)));
rechargeRequestsRoutes.get('/:id', authMiddleware, asyncHandler((req, res) => rechargeRequestsController.getById(req, res)));
rechargeRequestsRoutes.post('/', authMiddleware, asyncHandler((req, res) => rechargeRequestsController.create(req, res)));
rechargeRequestsRoutes.patch('/:id/payment', authMiddleware, asyncHandler((req, res) => rechargeRequestsController.updatePayment(req, res)));

module.exports = rechargeRequestsRoutes;
