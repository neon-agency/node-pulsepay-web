const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const asyncHandler = require('../utils/async-handler');
const authMiddleware = require('../middlewares/auth.middleware');
const usersService = require('../services/users.service');

const authRoutes = Router();

authRoutes.post('/login', asyncHandler((req, res) => authController.login(req, res)));
authRoutes.get('/me', authMiddleware, asyncHandler((req, res) => authController.me(req, res)));
authRoutes.patch('/me/whatsapp', authMiddleware, asyncHandler(async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: 'Usuário inválido' });
  }

  const user = await usersService.updateWhatsappPhone(req.user.id, req.body?.whatsappPhone);
  return res.status(200).json({ user });
}));

module.exports = authRoutes;
