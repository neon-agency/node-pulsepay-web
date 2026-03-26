const AppError = require('../errors/app-error');
const authService = require('../services/auth.service');

module.exports = function authMiddleware(req, _res, next) {
  const expectedInternalApiKey = process.env.INTERNAL_API_KEY;
  const providedInternalApiKey = req.headers['x-internal-api-key'];

  // Permite autenticação interna estática (ideal para ambiente serverless, como Vercel).
  if (expectedInternalApiKey && providedInternalApiKey === expectedInternalApiKey) {
    req.user = { type: 'internal', source: 'bot' };
    return next();
  }

  const authHeader = req.headers.authorization || '';
  const [type, token] = authHeader.split(' ');

  if (type !== 'Bearer' || !token) {
    throw new AppError('Token não informado', 401);
  }

  const session = authService.validateToken(token);
  if (!session) {
    throw new AppError('Token inválido ou expirado', 401);
  }

  req.user = session;
  next();
};
