const { Router } = require('express');
const serversController = require('../controllers/servers.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const serversRoutes = Router();

serversRoutes.get('/', authMiddleware, asyncHandler((req, res) => serversController.list(req, res)));
serversRoutes.get('/:id', authMiddleware, asyncHandler((req, res) => serversController.getById(req, res)));
serversRoutes.post('/', authMiddleware, asyncHandler((req, res) => serversController.create(req, res)));
serversRoutes.put('/:id', authMiddleware, asyncHandler((req, res) => serversController.update(req, res)));
serversRoutes.patch('/:id/promo', authMiddleware, asyncHandler((req, res) => serversController.setPromo(req, res)));
serversRoutes.delete('/:id', authMiddleware, asyncHandler((req, res) => serversController.remove(req, res)));

module.exports = serversRoutes;
