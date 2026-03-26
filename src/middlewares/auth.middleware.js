const AppError = require('../errors/app-error');
const authService = require('../services/auth.service');

module.exports = function authMiddleware(req, _res, next) {
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
