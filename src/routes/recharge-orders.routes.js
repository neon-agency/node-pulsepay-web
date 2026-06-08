const { Router } = require('express');
const rechargeOrdersController = require('../controllers/recharge-orders.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const rechargeOrdersRoutes = Router();

rechargeOrdersRoutes.get('/pending-count', authMiddleware, asyncHandler((req, res) => rechargeOrdersController.pendingCount(req, res)));
rechargeOrdersRoutes.get('/page', authMiddleware, asyncHandler((req, res) => rechargeOrdersController.page(req, res)));
rechargeOrdersRoutes.get('/:id', authMiddleware, asyncHandler((req, res) => rechargeOrdersController.getById(req, res)));
rechargeOrdersRoutes.get('/:id/payment-proof/file', authMiddleware, asyncHandler((req, res) => rechargeOrdersController.downloadLatestPaymentProofFile(req, res)));
rechargeOrdersRoutes.post('/:id/payment-proof', authMiddleware, asyncHandler((req, res) => rechargeOrdersController.uploadPaymentProof(req, res)));
rechargeOrdersRoutes.patch('/:id/payment-proof/review', authMiddleware, asyncHandler((req, res) => rechargeOrdersController.reviewLatestPaymentProof(req, res)));
rechargeOrdersRoutes.patch('/:id/items/:itemId/review', authMiddleware, asyncHandler((req, res) => rechargeOrdersController.reviewItem(req, res)));
rechargeOrdersRoutes.post('/', authMiddleware, asyncHandler((req, res) => rechargeOrdersController.create(req, res)));
rechargeOrdersRoutes.patch('/:id/archive', authMiddleware, asyncHandler((req, res) => rechargeOrdersController.archive(req, res)));
rechargeOrdersRoutes.patch('/:id/cancel', authMiddleware, asyncHandler((req, res) => rechargeOrdersController.cancel(req, res)));

module.exports = rechargeOrdersRoutes;
