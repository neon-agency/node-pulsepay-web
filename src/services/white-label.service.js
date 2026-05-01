const AppError = require('../errors/app-error');
const whiteLabelRepository = require('../repositories/white-label.repository');
const usersRepository = require('../repositories/users.repository');
const { createId } = require('../utils/id');

const VALID_SCHEMES = ['default', 'blue', 'purple', 'emerald', 'orange', 'rose', 'cyan', 'amber'];

class WhiteLabelService {
  async getForUser(userId) {
    const user = await usersRepository.findById(userId);
    if (!user || !user.isActive) throw new AppError('Usuário não encontrado', 404);

    const adminId = user.role === 'reseller' ? user.adminId : userId;
    if (!adminId) return null;

    return whiteLabelRepository.findByUserId(adminId);
  }

  async upsert(userId, { systemName, logoUrl, colorScheme }) {
    const user = await usersRepository.findById(userId);
    if (!user || !user.isActive) throw new AppError('Usuário não encontrado', 404);
    if (user.role !== 'admin') throw new AppError('Somente administradores podem configurar o white label', 403);

    if (colorScheme && !VALID_SCHEMES.includes(colorScheme)) {
      throw new AppError(`Esquema de cor inválido. Use: ${VALID_SCHEMES.join(', ')}`, 400);
    }

    if (systemName !== undefined) {
      const trimmed = String(systemName ?? '').trim();
      if (trimmed && trimmed.length > 160) throw new AppError('Nome do sistema muito longo (máx. 160 chars)', 400);
    }

    return whiteLabelRepository.upsert(userId, createId(), { systemName, logoUrl, colorScheme });
  }
}

module.exports = new WhiteLabelService();
