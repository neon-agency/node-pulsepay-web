const { Router } = require('express');
const credentialsController = require('../controllers/credentials.controller');
const asyncHandler = require('../utils/async-handler');

const botRoutes = Router();

botRoutes.post('/resolve-credential', asyncHandler((req, res) => credentialsController.resolveForBot(req, res)));

module.exports = botRoutes;
