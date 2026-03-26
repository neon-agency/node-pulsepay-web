const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const asyncHandler = require('../utils/async-handler');

const authRoutes = Router();

authRoutes.post('/login', asyncHandler((req, res) => authController.login(req, res)));

module.exports = authRoutes;
