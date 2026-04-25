const { Router } = require('express');
const pixKeysController = require('../controllers/pix-keys.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const pixKeysRoutes = Router();

pixKeysRoutes.use(authMiddleware);

pixKeysRoutes.get('/', asyncHandler((req, res) => pixKeysController.list(req, res)));
pixKeysRoutes.post('/', asyncHandler((req, res) => pixKeysController.create(req, res)));
pixKeysRoutes.patch('/:id', asyncHandler((req, res) => pixKeysController.update(req, res)));
pixKeysRoutes.delete('/:id', asyncHandler((req, res) => pixKeysController.remove(req, res)));

module.exports = pixKeysRoutes;
