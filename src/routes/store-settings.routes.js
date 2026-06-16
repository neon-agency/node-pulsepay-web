const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');
const storeSettingsService = require('../services/store-settings.service');

const storeSettingsRoutes = Router();

storeSettingsRoutes.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const storeSettings = await storeSettingsService.getForUser(req.user.id);
  return res.status(200).json({ storeSettings });
}));

storeSettingsRoutes.patch('/', authMiddleware, asyncHandler(async (req, res) => {
  const { isOpen, openingTime, closingTime, openDays } = req.body || {};
  const storeSettings = await storeSettingsService.upsert(req.user.id, {
    isOpen,
    openingTime,
    closingTime,
    openDays
  });
  return res.status(200).json({ storeSettings });
}));

module.exports = storeSettingsRoutes;
