const AppError = require('../errors/app-error');
const crypto = require('crypto');

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

function toBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const padded = padding ? normalized.padEnd(normalized.length + (4 - padding), '=') : normalized;
  return Buffer.from(padded, 'base64').toString('utf8');
}

class AuthService {
  getTokenSecret() {
    return process.env.API_TOKEN_SECRET || process.env.INTERNAL_API_KEY || 'pulsepay-dev-token-secret';
  }

  createSignature(data) {
    return crypto
      .createHmac('sha256', this.getTokenSecret())
      .update(data)
      .digest();
  }

  createToken(payload) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = toBase64Url(JSON.stringify(header));
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const data = `${encodedHeader}.${encodedPayload}`;
    const signature = toBase64Url(this.createSignature(data));

    return `${data}.${signature}`;
  }

  decodeAndValidateToken(token) {
    const [encodedHeader, encodedPayload, receivedSignature] = (token || '').split('.');
    if (!encodedHeader || !encodedPayload || !receivedSignature) return null;

    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = toBase64Url(this.createSignature(data));

    const expectedBuffer = Buffer.from(expectedSignature);
    const receivedBuffer = Buffer.from(receivedSignature);
    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return null;
    }

    try {
      const payload = JSON.parse(fromBase64Url(encodedPayload));
      if (typeof payload?.email !== 'string' || typeof payload?.exp !== 'number') {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
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

    const exp = Date.now() + TOKEN_TTL_MS;
    const token = this.createToken({ email, exp });
    const expiresAt = new Date(exp).toISOString();

    return { token, expiresAt, user: { email } };
  }

  validateToken(token) {
    const payload = this.decodeAndValidateToken(token);
    if (!payload) {
      return null;
    }

    if (payload.exp < Date.now()) {
      return null;
    }

    return {
      email: payload.email,
      expiresAt: new Date(payload.exp).toISOString(),
    };
  }
}

module.exports = new AuthService();
