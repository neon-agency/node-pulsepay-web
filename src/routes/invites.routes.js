const { Router } = require('express');
const invitesController = require('../controllers/invites.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/require-role.middleware');
const asyncHandler = require('../utils/async-handler');

const invitesRoutes = Router();

invitesRoutes.get(
  '/public/:token',
  asyncHandler((req, res) => invitesController.getPublic(req, res))
);

invitesRoutes.use(authMiddleware, requireRole('admin'));

invitesRoutes.get('/', asyncHandler((req, res) => invitesController.list(req, res)));
invitesRoutes.post('/', asyncHandler((req, res) => invitesController.create(req, res)));
invitesRoutes.post('/:id/renew', asyncHandler((req, res) => invitesController.renew(req, res)));
invitesRoutes.delete('/:id', asyncHandler((req, res) => invitesController.revoke(req, res)));

module.exports = invitesRoutes;
