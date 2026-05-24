const crypto = require('crypto');
const AppError = require('../errors/app-error');
const db = require('../database/knex');
const invitesRepository = require('../repositories/invites.repository');
const authService = require('./auth.service');
const { hashPassword } = require('../utils/password');
const { createId } = require('../utils/id');
const { sanitizeTelefone, isValidTelefone } = require('../utils/phone');
const { normalizeCredentialName } = require('../utils/credential');

const DEFAULT_EXPIRES_IN_DAYS = 7;
const MIN_EXPIRES_IN_DAYS = 1;
const MAX_EXPIRES_IN_DAYS = 90;

function hashToken(plainToken) {
  return crypto.createHash('sha256').update(String(plainToken)).digest('hex');
}

function generatePlainToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function computeStatus(invite) {
  if (invite.revokedAt) return 'revoked';
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    return 'expired';
  }
  return 'active';
}

function toPublicInvite(invite) {
  return {
    id: invite.id,
    tokenPreview: invite.tokenPreview,
    status: computeStatus(invite),
    expiresAt: invite.expiresAt,
    usageCount: invite.usageCount,
    revokedAt: invite.revokedAt || null,
    createdAt: invite.createdAt
  };
}

function todayDateOnly() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

class InvitesService {
  async create({ adminId, expiresInDays }) {
    if (!adminId) throw new AppError('Acesso negado', 403);

    const requestedDays = Number(expiresInDays);
    const days = Number.isFinite(requestedDays) && requestedDays > 0
      ? Math.min(MAX_EXPIRES_IN_DAYS, Math.max(MIN_EXPIRES_IN_DAYS, Math.floor(requestedDays)))
      : DEFAULT_EXPIRES_IN_DAYS;

    const plainToken = generatePlainToken();
    const tokenHash = hashToken(plainToken);
    const tokenPreview = plainToken.slice(0, 8);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const invite = await invitesRepository.create({
      id: createId(),
      tokenHash,
      tokenPreview,
      adminId,
      expiresAt
    });

    return {
      ...toPublicInvite(invite),
      token: plainToken
    };
  }

  async list({ adminId }) {
    if (!adminId) throw new AppError('Acesso negado', 403);
    const rows = await invitesRepository.listByAdmin(adminId);
    return rows.map(toPublicInvite);
  }

  async revoke({ adminId, id, userId }) {
    if (!adminId) throw new AppError('Acesso negado', 403);
    if (!id) throw new AppError('Convite inválido', 400);

    const existing = await invitesRepository.findByIdScoped(adminId, id);
    if (!existing) {
      throw new AppError('Convite não encontrado', 404);
    }

    if (computeStatus(existing) === 'revoked') {
      throw new AppError('Convite já foi revogado', 410);
    }

    const updated = await invitesRepository.markRevoked({ id, userId });
    if (!updated) {
      throw new AppError('Não foi possível revogar o convite', 409);
    }

    return toPublicInvite(updated);
  }

  async getPublicByToken(plainToken) {
    if (!plainToken) throw new AppError('Convite inválido', 400);

    const tokenHash = hashToken(plainToken);
    const row = await db('invites')
      .leftJoin('users', 'invites.admin_id', 'users.id')
      .where('invites.token_hash', tokenHash)
      .select(
        'invites.id as id',
        'invites.token_preview as token_preview',
        'invites.admin_id as admin_id',
        'invites.expires_at as expires_at',
        'invites.revoked_at as revoked_at',
        'invites.created_at as created_at',
        'users.name as admin_name'
      )
      .first();

    if (!row) {
      throw new AppError('Convite não encontrado', 404);
    }

    const invite = {
      id: row.id,
      tokenPreview: row.token_preview,
      adminId: row.admin_id,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      createdAt: row.created_at
    };

    const status = computeStatus(invite);
    if (status === 'revoked') throw new AppError('Convite foi revogado', 410);
    if (status === 'expired') throw new AppError('Convite expirado', 410);

    return {
      valid: true,
      expiresAt: invite.expiresAt,
      adminName: row.admin_name || null
    };
  }

  async consumeAndSignup({ plainToken, name, email, password, whatsappPhone }) {
    if (!plainToken) throw new AppError('Convite inválido', 400);
    if (!name || !String(name).trim()) throw new AppError('Nome é obrigatório', 400);
    if (!email || !String(email).trim()) throw new AppError('Email é obrigatório', 400);

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
      throw new AppError('Email inválido', 400);
    }

    const plainPassword = String(password ?? '');
    if (plainPassword.length < 6) {
      throw new AppError('Senha deve ter ao menos 6 caracteres', 400);
    }

    const phone = sanitizeTelefone(whatsappPhone);
    if (!isValidTelefone(phone)) {
      throw new AppError('WhatsApp inválido. Informe entre 10 e 15 dígitos.', 400);
    }

    const trimmedName = String(name).trim();
    const tokenHash = hashToken(plainToken);

    const result = await db.transaction(async (trx) => {
      const invite = await invitesRepository.findByTokenHash(tokenHash, trx);
      if (!invite) {
        throw new AppError('Convite não encontrado', 404);
      }

      const status = computeStatus(invite);
      if (status === 'revoked') throw new AppError('Convite foi revogado', 410);
      if (status === 'expired') throw new AppError('Convite expirado', 410);

      const emailInUseUser = await trx('users')
        .whereRaw('LOWER(email) = ?', [normalizedEmail])
        .first();
      if (emailInUseUser) {
        throw new AppError('Já existe usuário com este email', 409);
      }

      const emailInUseClient = await trx('clients')
        .whereRaw('LOWER(email) = ?', [normalizedEmail])
        .first();
      if (emailInUseClient) {
        throw new AppError('Já existe revenda com este email', 409);
      }

      const clientId = createId();
      const [clientRow] = await trx('clients')
        .insert({
          id: clientId,
          nome: trimmedName,
          email: normalizedEmail,
          telefone: phone,
          tipo: 'revenda',
          servidor_id: null,
          plano: null,
          status: 'ativo',
          vencimento: todayDateOnly(),
          status_vencimento: 'ok'
        })
        .returning('*');

      const userId = createId();
      const [userRow] = await trx('users')
        .insert({
          id: userId,
          name: trimmedName,
          email: normalizedEmail,
          password_hash: hashPassword(plainPassword),
          role: 'reseller',
          client_id: clientId,
          admin_id: invite.adminId,
          whatsapp_phone: phone,
          welcome_password: null,
          is_active: true
        })
        .returning('*');

      const credentialId = createId();
      await trx('credentials').insert({
        id: credentialId,
        nome: trimmedName,
        last4: '0000',
        nome_normalized: normalizeCredentialName(trimmedName),
        credential_key: clientId,
        client_id: clientId
      });

      const bumped = await invitesRepository.incrementUsage({
        id: invite.id,
        trx
      });

      if (!bumped) {
        throw new AppError('Convite não está mais disponível', 410);
      }

      return { userRow, clientRow };
    });

    const { userRow } = result;
    const tokenVersion = typeof userRow.token_version === 'number' ? userRow.token_version : 0;
    const exp = Date.now() + 8 * 60 * 60 * 1000;
    const token = authService.createToken({
      userId: userRow.id,
      email: userRow.email,
      name: userRow.name,
      role: userRow.role,
      clientId: userRow.client_id || null,
      whatsappPhone: userRow.whatsapp_phone,
      tokenVersion,
      exp
    });

    return {
      token,
      expiresAt: new Date(exp).toISOString(),
      user: {
        id: userRow.id,
        name: userRow.name,
        email: userRow.email,
        role: userRow.role,
        clientId: userRow.client_id || null,
        whatsappPhone: userRow.whatsapp_phone,
        isActive: Boolean(userRow.is_active)
      }
    };
  }
}

module.exports = new InvitesService();
