const { Router } = require('express');
const clientsController = require('../controllers/clients.controller');
const asyncHandler = require('../utils/async-handler');

const clientsRoutes = Router();

clientsRoutes.get('/', asyncHandler((req, res) => clientsController.list(req, res)));
clientsRoutes.get('/resellers-page', asyncHandler((req, res) => clientsController.resellersPage(req, res)));
clientsRoutes.get('/:id', asyncHandler((req, res) => clientsController.getById(req, res)));
clientsRoutes.post('/', asyncHandler((req, res) => clientsController.create(req, res)));
clientsRoutes.put('/:id', asyncHandler((req, res) => clientsController.update(req, res)));
clientsRoutes.delete('/:id', asyncHandler((req, res) => clientsController.remove(req, res)));

module.exports = clientsRoutes;
