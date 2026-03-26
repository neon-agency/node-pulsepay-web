const { Router } = require('express');
const credentialsController = require('../controllers/credentials.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const botRoutes = Router();

botRoutes.post('/resolve-credential', authMiddleware, asyncHandler((req, res) => credentialsController.resolveForBot(req, res)));

module.exports = botRoutes;
