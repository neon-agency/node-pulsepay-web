const AppError = require('../errors/app-error');

function requireRole(...allowedRoles) {
  const roles = allowedRoles.flat().filter(Boolean);

  return function requireRoleMiddleware(req, _res, next) {
    if (!req.user) {
      return next(new AppError('Acesso negado', 401));
    }

    if (req.user.type === 'internal') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Acesso negado', 403));
    }

    return next();
  };
}

module.exports = requireRole;
