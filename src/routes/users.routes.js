const { Router } = require('express');
const usersController = require('../controllers/users.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const usersRoutes = Router();

usersRoutes.post('/', authMiddleware, asyncHandler((req, res) => usersController.create(req, res)));
usersRoutes.patch('/active/:clientId', authMiddleware, asyncHandler((req, res) => usersController.setActive(req, res)));
usersRoutes.patch('/password/:clientId', authMiddleware, asyncHandler((req, res) => usersController.updatePassword(req, res)));

module.exports = usersRoutes;
