const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');
const userPreferencesService = require('../services/user-preferences.service');

const userPreferencesRoutes = Router();

userPreferencesRoutes.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const preferences = await userPreferencesService.getForUser(req.user.id);
  return res.status(200).json({ preferences });
}));

userPreferencesRoutes.patch('/', authMiddleware, asyncHandler(async (req, res) => {
  const { theme, colorScheme, customColor } = req.body ?? {};
  const preferences = await userPreferencesService.upsert(req.user.id, {
    theme,
    colorScheme,
    customColor,
  });
  return res.status(200).json({ preferences });
}));

module.exports = userPreferencesRoutes;
