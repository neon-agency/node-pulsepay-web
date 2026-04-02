const AppError = require('../errors/app-error');
const usersRepository = require('../repositories/users.repository');
const { sanitizeTelefone, isValidTelefone } = require('../utils/phone');

class UsersService {
  async getById(id) {
    const user = await usersRepository.findById(id);
    if (!user || !user.isActive) {
      throw new AppError('Usuário não encontrado', 404);
    }

    return this.toPublicUser(user);
  }

  async updateWhatsappPhone(userId, rawPhone) {
    const normalized = sanitizeTelefone(rawPhone);
    if (!normalized || !isValidTelefone(normalized)) {
      throw new AppError('WhatsApp inválido. Informe entre 10 e 15 dígitos.', 400);
    }

    const user = await usersRepository.updateWhatsappPhone(userId, normalized);
    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    return this.toPublicUser(user);
  }

  toPublicUser(user) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      whatsappPhone: user.whatsappPhone || null
    };
  }
}

module.exports = new UsersService();
