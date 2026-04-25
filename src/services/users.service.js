const AppError = require('../errors/app-error');
const usersRepository = require('../repositories/users.repository');
const clientsRepository = require('../repositories/clients.repository');
const { sanitizeTelefone, isValidTelefone } = require('../utils/phone');
const { hashPassword } = require('../utils/password');
const { createId } = require('../utils/id');
const resellerWelcomeNotificationsService = require('./reseller-welcome-notifications.service');

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

    let whatsappPhone = null;
    if (clientId) {
      try {
        const client = await clientsRepository.findById(clientId);
        const candidate = sanitizeTelefone(client?.telefone);
        if (candidate && isValidTelefone(candidate)) {
          whatsappPhone = candidate;
        }
      } catch (error) {
        console.error('Falha ao carregar telefone do cliente para o usuário:', error);
      }
    }

    const user = await usersRepository.create({
      id: createId(),
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(String(password)),
      role,
      clientId: clientId || null,
      whatsappPhone,
      isActive: true
    });

    if (role === 'reseller' && user.whatsappPhone) {
      try {
        await resellerWelcomeNotificationsService.notify({
          phone: user.whatsappPhone,
          email: user.email,
          password: String(password)
        });
      } catch (error) {
        console.error('Falha ao enviar boas-vindas da revenda:', error);
      }
    }

    return user;
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

    if (user.clientId) {
      try {
        await clientsRepository.updateTelefone(user.clientId, normalized);
      } catch (error) {
        console.error('Falha ao sincronizar telefone do cliente vinculado:', error);
      }
    }

    return this.toPublicUser(user);
  }

  async updateProfile(userId, { name, email, password }) {
    const user = await usersRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new AppError('Usuário não encontrado', 404);
    }

    const updates = {};

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) throw new AppError('Nome não pode ser vazio', 400);
      updates.name = trimmed;
    }

    if (email !== undefined) {
      const normalized = String(email).trim().toLowerCase();
      if (!/\S+@\S+\.\S+/.test(normalized)) throw new AppError('Email inválido', 400);
      const existing = await usersRepository.findByEmail(normalized);
      if (existing && existing.id !== userId) throw new AppError('Email já em uso', 409);
      updates.email = normalized;
    }

    if (password !== undefined) {
      const pwd = String(password);
      if (pwd.length < 6) throw new AppError('Senha deve ter ao menos 6 caracteres', 400);
      updates.passwordHash = hashPassword(pwd);
    }

    if (Object.keys(updates).length === 0) {
      return this.toPublicUser(user);
    }

    const updated = await usersRepository.updateProfile(userId, updates);
    return this.toPublicUser(updated);
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
