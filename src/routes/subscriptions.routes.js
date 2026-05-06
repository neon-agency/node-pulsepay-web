const { Router } = require('express');
const subscriptionsController = require('../controllers/subscriptions.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const subscriptionsRoutes = Router();

subscriptionsRoutes.get('/me', authMiddleware, asyncHandler((req, res) => subscriptionsController.me(req, res)));
subscriptionsRoutes.post('/start', authMiddleware, asyncHandler((req, res) => subscriptionsController.start(req, res)));

module.exports = subscriptionsRoutes;

