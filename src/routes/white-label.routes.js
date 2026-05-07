const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');
const whiteLabelService = require('../services/white-label.service');

const whiteLabelRoutes = Router();

// Público — usado pelo provider antes do login pra detectar marca via domínio
whiteLabelRoutes.get('/by-domain', asyncHandler(async (req, res) => {
  const domain = req.query?.domain;
  const config = await whiteLabelService.getByDomain(domain);
  return res.status(200).json({ whiteLabel: config });
}));

whiteLabelRoutes.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const config = await whiteLabelService.getForUser(req.user.id);
  return res.status(200).json({ whiteLabel: config });
}));

whiteLabelRoutes.post('/logo', authMiddleware, asyncHandler(async (req, res) => {
  const { fileName, mimeType, contentBase64 } = req.body ?? {};
  const forwardedProto = req.headers['x-forwarded-proto'] || req.protocol;
  const forwardedHost = req.headers['x-forwarded-host'] || req.get('host');
  const publicBaseUrl = forwardedHost ? `${forwardedProto}://${forwardedHost}` : null;
  const result = await whiteLabelService.uploadLogo(req.user.id, {
    fileName,
    mimeType,
    contentBase64,
    publicBaseUrl,
  });
  return res.status(201).json(result);
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
