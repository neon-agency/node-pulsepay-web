const { Router } = require('express');
const rechargeRequestsController = require('../controllers/recharge-requests.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const rechargeRequestsRoutes = Router();

rechargeRequestsRoutes.get('/', authMiddleware, asyncHandler((req, res) => rechargeRequestsController.list(req, res)));
rechargeRequestsRoutes.get('/page', authMiddleware, asyncHandler((req, res) => rechargeRequestsController.page(req, res)));
rechargeRequestsRoutes.get('/:id', authMiddleware, asyncHandler((req, res) => rechargeRequestsController.getById(req, res)));
rechargeRequestsRoutes.get('/:id/payment-proof', authMiddleware, asyncHandler((req, res) => rechargeRequestsController.getLatestPaymentProof(req, res)));
rechargeRequestsRoutes.get('/:id/payment-proof/file', authMiddleware, asyncHandler((req, res) => rechargeRequestsController.downloadLatestPaymentProofFile(req, res)));
rechargeRequestsRoutes.post('/:id/payment-proof', authMiddleware, asyncHandler((req, res) => rechargeRequestsController.uploadPaymentProof(req, res)));
rechargeRequestsRoutes.patch('/:id/payment-proof/review', authMiddleware, asyncHandler((req, res) => rechargeRequestsController.reviewLatestPaymentProof(req, res)));
rechargeRequestsRoutes.post('/', authMiddleware, asyncHandler((req, res) => rechargeRequestsController.create(req, res)));
rechargeRequestsRoutes.patch('/:id/payment', authMiddleware, asyncHandler((req, res) => rechargeRequestsController.updatePayment(req, res)));
rechargeRequestsRoutes.patch('/:id/archive', authMiddleware, asyncHandler((req, res) => rechargeRequestsController.archive(req, res)));
rechargeRequestsRoutes.patch('/:id/cancel', authMiddleware, asyncHandler((req, res) => rechargeRequestsController.cancel(req, res)));

module.exports = rechargeRequestsRoutes;
