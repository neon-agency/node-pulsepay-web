const AppError = require('../errors/app-error');
const usersRepository = require('../repositories/users.repository');
const { sanitizeTelefone, isValidTelefone } = require('../utils/phone');
const { hashPassword } = require('../utils/password');
const { createId } = require('../utils/id');

class UsersService {
  async create({ name, email, password, role = 'reseller', clientId = null }) {
    if (!name || !email || !password) {
      throw new AppError('Nome, email e senha são obrigatórios', 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await usersRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new AppError('Já existe um usuário com este email', 409);
    }

    return usersRepository.create({
      id: createId(),
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(String(password)),
      role,
      clientId: clientId || null,
      isActive: true
    });
  }

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
      clientId: user.clientId || null,
      whatsappPhone: user.whatsappPhone || null
    };
  }
}

module.exports = new UsersService();
