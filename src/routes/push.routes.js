const { Router } = require('express');
const pushController = require('../controllers/push.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const pushRoutes = Router();

pushRoutes.get('/vapid-public-key', authMiddleware, asyncHandler((req, res) => pushController.vapidPublicKey(req, res)));
pushRoutes.post('/subscribe', authMiddleware, asyncHandler((req, res) => pushController.subscribe(req, res)));
pushRoutes.post('/unsubscribe', authMiddleware, asyncHandler((req, res) => pushController.unsubscribe(req, res)));

module.exports = pushRoutes;
