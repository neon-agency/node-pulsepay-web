const AppError = require('../errors/app-error');
const { createId } = require('../utils/id');

class AuthService {
  constructor() {
    this.tokens = new Map();
  }

  login(email, password) {
    const validEmail = process.env.API_LOGIN_EMAIL || 'admin@pulsepay.com';
    const validPassword = process.env.API_LOGIN_PASSWORD || 'pulsepay123';

    if (!email || !password) {
      throw new AppError('Email e senha são obrigatórios', 400);
    }

    if (email !== validEmail || password !== validPassword) {
      throw new AppError('Credenciais inválidas', 401);
    }

    const token = createId();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

    this.tokens.set(token, { email, expiresAt });

    return { token, expiresAt, user: { email } };
  }

  validateToken(token) {
    const session = this.tokens.get(token);
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.tokens.delete(token);
      return null;
    }

    return session;
  }
}

module.exports = new AuthService();
