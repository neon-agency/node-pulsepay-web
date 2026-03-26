const AppError = require('../errors/app-error');
const ServerModel = require('../models/server.model');
const serversRepository = require('../repositories/servers.repository');

class ServersService {
  parseBasePrice(value, fallback = null) {
    if (value === undefined || value === null || value === '') return fallback;

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new AppError('Campo "basePrice" deve ser um número maior ou igual a zero', 400);
    }

    return Number(parsed.toFixed(2));
  }

  async list() {
    return serversRepository.findAll();
  }

  async getById(id) {
    const server = await serversRepository.findById(id);
    if (!server) {
      throw new AppError('Servidor não encontrado', 404);
    }

    return server;
  }

  async create(payload) {
    const servidor = String(payload?.servidor || '').trim();
    const basePrice = this.parseBasePrice(payload?.basePrice, 10);

    if (!servidor) {
      throw new AppError('Campo "servidor" é obrigatório', 400);
    }

    const item = new ServerModel({ servidor, basePrice });
    return serversRepository.create(item);
  }

  async update(id, payload) {
    const current = await this.getById(id);
    const servidor = payload?.servidor !== undefined ? String(payload.servidor).trim() : current.servidor;
    const basePrice = payload?.basePrice !== undefined
      ? this.parseBasePrice(payload.basePrice)
      : current.basePrice;

    if (!servidor) {
      throw new AppError('Campo "servidor" não pode ser vazio', 400);
    }

    return serversRepository.update(id, { servidor, basePrice });
  }

  async remove(id) {
    await this.getById(id);
    await serversRepository.remove(id);
  }
}

module.exports = new ServersService();
