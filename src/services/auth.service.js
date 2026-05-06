const AppError = require('../errors/app-error');
const crypto = require('crypto');
const { createId } = require('../utils/id');
const { hashPassword, verifyPassword } = require('../utils/password');
const { sanitizeTelefone, isValidTelefone } = require('../utils/phone');
const usersRepository = require('../repositories/users.repository');

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
  isMissingUsersTable(error) {
    return (
      error &&
      typeof error === 'object' &&
      error.code === '42P01' &&
      typeof error.message === 'string' &&
      error.message.includes('"users"')
    );
  }

  getEnvAdminUser() {
    const email = String(process.env.API_LOGIN_EMAIL || 'admin@pulsepay.com').trim().toLowerCase();
    const password = String(process.env.API_LOGIN_PASSWORD || 'pulsepay123');
    const name = String(process.env.API_LOGIN_NAME || 'Admin PulsePay').trim();
    const role = String(process.env.API_LOGIN_ROLE || 'admin').trim();
    const rawWhatsapp = String(process.env.API_LOGIN_WHATSAPP_PHONE || '').trim();
    const whatsappPhone = rawWhatsapp ? sanitizeTelefone(rawWhatsapp) : null;

    return {
      id: 'env-admin',
      name,
      email,
      role,
      password,
      whatsappPhone: whatsappPhone && isValidTelefone(whatsappPhone) ? whatsappPhone : null,
      isActive: true
    };
  }

  async ensureDefaultAdminUser() {
    const envUser = this.getEnvAdminUser();

    try {
      const existing = await usersRepository.findByEmail(envUser.email);
      if (existing) {
        return existing;
      }

      return usersRepository.create({
        id: createId(),
        name: envUser.name,
        email: envUser.email,
        passwordHash: hashPassword(envUser.password),
        role: envUser.role,
        whatsappPhone: envUser.whatsappPhone,
        isActive: true
      });
    } catch (error) {
      if (this.isMissingUsersTable(error)) {
        return envUser;
      }

      throw error;
    }
  }

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
      if (
        typeof payload?.email !== 'string' ||
        typeof payload?.userId !== 'string' ||
        typeof payload?.exp !== 'number'
      ) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  async login(email, password) {
    if (!email || !password) {
      throw new AppError('Email e senha são obrigatórios', 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const defaultUser = await this.ensureDefaultAdminUser();

    let user = null;
    try {
      user = await usersRepository.findByEmail(normalizedEmail);
    } catch (error) {
      if (!this.isMissingUsersTable(error)) {
        throw error;
      }
    }

    if (!user && defaultUser.email === normalizedEmail && defaultUser.password === password) {
      user = defaultUser;
    }

    const passwordIsValid = user
      ? ('passwordHash' in user ? verifyPassword(password, user.passwordHash) : user.password === password)
      : false;

    if (!user || !user.isActive || !passwordIsValid) {
      throw new AppError('Credenciais inválidas', 401);
    }

    const exp = Date.now() + TOKEN_TTL_MS;
    const token = this.createToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      clientId: user.clientId || null,
      whatsappPhone: user.whatsappPhone,
      tokenVersion: typeof user.tokenVersion === 'number' ? user.tokenVersion : 0,
      exp
    });
    const expiresAt = new Date(exp).toISOString();

    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        clientId: user.clientId || null,
        whatsappPhone: user.whatsappPhone
      }
    };
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
      id: payload.userId,
      email: payload.email,
      name: payload.name || '',
      role: payload.role || 'admin',
      clientId: payload.clientId || null,
      whatsappPhone: payload.whatsappPhone || null,
      tokenVersion: typeof payload.tokenVersion === 'number' ? payload.tokenVersion : 0,
      expiresAt: new Date(payload.exp).toISOString()
    };
  }
}

module.exports = new AuthService();
