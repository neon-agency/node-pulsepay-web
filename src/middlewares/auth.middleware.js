const AppError = require('../errors/app-error');
const authService = require('../services/auth.service');
const usersService = require('../services/users.service');
const usersRepository = require('../repositories/users.repository');

module.exports = async function authMiddleware(req, _res, next) {
  const expectedInternalApiKey = process.env.INTERNAL_API_KEY || process.env.API_TOKEN_SECRET || 'pulsepay-dev-token-secret';
  const providedInternalApiKey = req.headers['x-internal-api-key'];

  try {
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

    try {
      const dbUser = await usersRepository.findById(session.id);
      if (!dbUser || !dbUser.isActive) {
        throw new AppError('Sessão inválida', 401);
      }
      const sessionVersion = typeof session.tokenVersion === 'number' ? session.tokenVersion : 0;
      if ((dbUser.tokenVersion || 0) !== sessionVersion) {
        throw new AppError('Sessão expirada. Faça login novamente.', 401);
      }
      req.user = usersService.toPublicUser(dbUser);
      req.user.expiresAt = session.expiresAt;
    } catch (error) {
      if (error instanceof AppError) throw error;
      req.user = session;
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
