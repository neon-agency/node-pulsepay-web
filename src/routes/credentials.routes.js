const { Router } = require('express');
const credentialsController = require('../controllers/credentials.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const credentialsRoutes = Router();

credentialsRoutes.get('/', authMiddleware, asyncHandler((req, res) => credentialsController.list(req, res)));
credentialsRoutes.get('/:id', authMiddleware, asyncHandler((req, res) => credentialsController.getById(req, res)));
credentialsRoutes.post('/', authMiddleware, asyncHandler((req, res) => credentialsController.create(req, res)));
credentialsRoutes.put('/:id', authMiddleware, asyncHandler((req, res) => credentialsController.update(req, res)));
credentialsRoutes.delete('/:id', authMiddleware, asyncHandler((req, res) => credentialsController.remove(req, res)));

credentialsRoutes.get('/:id/servers', authMiddleware, asyncHandler((req, res) => credentialsController.listServers(req, res)));
credentialsRoutes.put('/:id/servers', authMiddleware, asyncHandler((req, res) => credentialsController.replaceServers(req, res)));

module.exports = credentialsRoutes;
