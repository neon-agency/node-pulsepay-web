const { Router } = require('express');
const paymentWebhookController = require('../controllers/payment-webhook.controller');
const asyncHandler = require('../utils/async-handler');

const webhookRoutes = Router();

webhookRoutes.post('/payment', asyncHandler((req, res) => paymentWebhookController.handle(req, res)));

module.exports = webhookRoutes;

