const { Router } = require('express');
const noticesController = require('../controllers/notices.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const noticesRoutes = Router();

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso negado' });
  }
  return next();
}

noticesRoutes.get('/active', authMiddleware, asyncHandler((req, res) => noticesController.listActive(req, res)));

noticesRoutes.get('/', authMiddleware, adminOnly, asyncHandler((req, res) => noticesController.list(req, res)));
noticesRoutes.get('/:id', authMiddleware, adminOnly, asyncHandler((req, res) => noticesController.getById(req, res)));
noticesRoutes.post('/', authMiddleware, adminOnly, asyncHandler((req, res) => noticesController.create(req, res)));
noticesRoutes.post('/banner', authMiddleware, adminOnly, asyncHandler((req, res) => noticesController.uploadBanner(req, res)));
noticesRoutes.put('/:id', authMiddleware, adminOnly, asyncHandler((req, res) => noticesController.update(req, res)));
noticesRoutes.delete('/:id', authMiddleware, adminOnly, asyncHandler((req, res) => noticesController.remove(req, res)));

module.exports = noticesRoutes;
