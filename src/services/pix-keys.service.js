const AppError = require('../errors/app-error');
const pixKeysRepository = require('../repositories/pix-keys.repository');
const { createId } = require('../utils/id');

const MAX_KEYS_PER_USER = 5;
const ALLOWED_TYPES = new Set(['cpf', 'cnpj', 'email', 'telefone', 'aleatoria']);

class PixKeysService {
  validatePayload({ tipo, chave, nomeTitular }) {
    if (!tipo || !ALLOWED_TYPES.has(String(tipo).toLowerCase())) {
      throw new AppError('Tipo de chave PIX inválido.', 400);
    }
    if (!chave || !String(chave).trim()) {
      throw new AppError('Chave PIX é obrigatória.', 400);
    }
    if (!nomeTitular || !String(nomeTitular).trim()) {
      throw new AppError('Nome do titular é obrigatório.', 400);
    }
  }

  async list(userId) {
    return pixKeysRepository.findAllByUser(userId);
  }

  async create(userId, payload) {
    this.validatePayload(payload);
    const total = await pixKeysRepository.countByUser(userId);
    if (total >= MAX_KEYS_PER_USER) {
      throw new AppError(`Limite máximo de ${MAX_KEYS_PER_USER} chaves PIX atingido.`, 400);
    }
    const shouldBeDefault = total === 0 ? true : Boolean(payload.isDefault);
    return pixKeysRepository.create({
      id: createId(),
      userId,
      tipo: String(payload.tipo).toLowerCase(),
      chave: String(payload.chave).trim(),
      nomeTitular: String(payload.nomeTitular).trim(),
      isDefault: shouldBeDefault
    });
  }

  async update(userId, id, payload) {
    const existing = await pixKeysRepository.findById(id);
    if (!existing || existing.userId !== userId) {
      throw new AppError('Chave PIX não encontrada.', 404);
    }
    const updates = {};
    if (payload.tipo !== undefined) {
      if (!ALLOWED_TYPES.has(String(payload.tipo).toLowerCase())) {
        throw new AppError('Tipo de chave PIX inválido.', 400);
      }
      updates.tipo = String(payload.tipo).toLowerCase();
    }
    if (payload.chave !== undefined) {
      const chave = String(payload.chave).trim();
      if (!chave) throw new AppError('Chave PIX é obrigatória.', 400);
      updates.chave = chave;
    }
    if (payload.nomeTitular !== undefined) {
      const nome = String(payload.nomeTitular).trim();
      if (!nome) throw new AppError('Nome do titular é obrigatório.', 400);
      updates.nomeTitular = nome;
    }
    if (payload.isDefault !== undefined) {
      updates.isDefault = Boolean(payload.isDefault);
      if (existing.isDefault && updates.isDefault === false) {
        throw new AppError('Defina outra chave como principal antes de desativar.', 400);
      }
    }
    return pixKeysRepository.update(id, userId, updates);
  }

  async remove(userId, id) {
    const ok = await pixKeysRepository.delete(id, userId);
    if (!ok) throw new AppError('Chave PIX não encontrada.', 404);
    return { success: true };
  }

  async findByIdForUser(userId, id) {
    if (!id) return null;
    const row = await pixKeysRepository.findById(id);
    if (!row || row.userId !== userId) return null;
    return row;
  }
}

async function resolvePixKeyForLink(credentialId, serverId) {
  if (!credentialId || !serverId) return null;
  const credentialServersRepository = require('../repositories/credential-servers.repository');
  const link = await credentialServersRepository.findOneByCredentialAndServer(credentialId, serverId);
  if (link?.pixKeyId) {
    const row = await pixKeysRepository.findById(link.pixKeyId);
    if (row) return row;
  }
  const db = require('../database/knex');
  const defaultRow = await db('pix_keys').where({ is_default: true }).first();
  return defaultRow ? pixKeysRepository.mapRow(defaultRow) : null;
}

module.exports = new PixKeysService();
module.exports.MAX_KEYS_PER_USER = MAX_KEYS_PER_USER;
module.exports.resolvePixKeyForLink = resolvePixKeyForLink;
