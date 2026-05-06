const { Router } = require('express');
const usersController = require('../controllers/users.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const usersRoutes = Router();

usersRoutes.post('/', authMiddleware, asyncHandler((req, res) => usersController.create(req, res)));
usersRoutes.post('/resend-welcome/:clientId', authMiddleware, asyncHandler((req, res) => usersController.resendWelcome(req, res)));
usersRoutes.post('/welcome-link/:clientId', authMiddleware, asyncHandler((req, res) => usersController.welcomeLink(req, res)));

module.exports = usersRoutes;
