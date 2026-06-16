const AppError = require('../errors/app-error');
const storeSettingsRepository = require('../repositories/store-settings.repository');
const usersRepository = require('../repositories/users.repository');
const { createId } = require('../utils/id');

const DEFAULTS = {
  isOpen: true,
  openingTime: null,
  closingTime: null,
  openDays: null
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

class StoreSettingsService {
  validateTime(value) {
    if (value === undefined || value === null || value === '') return true;
    return TIME_RE.test(String(value));
  }

  validateOpenDays(days) {
    if (days === undefined || days === null) return true;
    if (!Array.isArray(days)) return false;
    return days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  }

  async resolveAdminId(userId) {
    const user = await usersRepository.findById(userId);
    if (!user || !user.isActive) throw new AppError('Usuário não encontrado', 404);

    let adminId = user.role === 'reseller' ? user.adminId : userId;
    if (user.role === 'reseller' && !adminId) {
      const firstAdmin = await usersRepository.findFirstAdmin();
      adminId = firstAdmin?.id ?? null;
    }
    return adminId;
  }

  async getForUser(userId) {
    const adminId = await this.resolveAdminId(userId);
    if (!adminId) return { ...DEFAULTS };

    const config = await storeSettingsRepository.findByAdminId(adminId);
    return config || { ...DEFAULTS };
  }

  async upsert(userId, { isOpen, openingTime, closingTime, openDays }) {
    const user = await usersRepository.findById(userId);
    if (!user || !user.isActive) throw new AppError('Usuário não encontrado', 404);
    if (user.role !== 'admin') {
      throw new AppError('Somente administradores podem configurar a loja', 403);
    }

    if (!this.validateTime(openingTime)) {
      throw new AppError('Horário de abertura inválido (use HH:MM)', 400);
    }
    if (!this.validateTime(closingTime)) {
      throw new AppError('Horário de fechamento inválido (use HH:MM)', 400);
    }
    if (!this.validateOpenDays(openDays)) {
      throw new AppError('Dias inválidos (use uma lista de 0 a 6)', 400);
    }

    return storeSettingsRepository.upsert(userId, createId(), {
      isOpen,
      openingTime: openingTime === undefined ? undefined : (openingTime || null),
      closingTime: closingTime === undefined ? undefined : (closingTime || null),
      openDays
    });
  }
}

module.exports = new StoreSettingsService();
