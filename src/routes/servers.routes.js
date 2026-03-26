const { Router } = require('express');
const serversController = require('../controllers/servers.controller');
const asyncHandler = require('../utils/async-handler');

const serversRoutes = Router();

serversRoutes.get('/', asyncHandler((req, res) => serversController.list(req, res)));
serversRoutes.get('/:id', asyncHandler((req, res) => serversController.getById(req, res)));
serversRoutes.post('/', asyncHandler((req, res) => serversController.create(req, res)));
serversRoutes.put('/:id', asyncHandler((req, res) => serversController.update(req, res)));
serversRoutes.delete('/:id', asyncHandler((req, res) => serversController.remove(req, res)));

module.exports = serversRoutes;
