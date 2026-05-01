const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');
const whiteLabelService = require('../services/white-label.service');

const whiteLabelRoutes = Router();

whiteLabelRoutes.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const config = await whiteLabelService.getForUser(req.user.id);
  return res.status(200).json({ whiteLabel: config });
}));

whiteLabelRoutes.patch('/', authMiddleware, asyncHandler(async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso negado' });
  }

  const { systemName, logoUrl, colorScheme, fontFamily, customColor } = req.body ?? {};
  const whiteLabel = await whiteLabelService.upsert(req.user.id, {
    systemName,
    logoUrl,
    colorScheme,
    fontFamily,
    customColor,
  });
  return res.status(200).json({ whiteLabel });
}));

module.exports = whiteLabelRoutes;
