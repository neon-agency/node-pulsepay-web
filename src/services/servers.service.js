const AppError = require('../errors/app-error');
const ServerModel = require('../models/server.model');
const serversRepository = require('../repositories/servers.repository');

class ServersService {
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

    if (!servidor) {
      throw new AppError('Campo "servidor" é obrigatório', 400);
    }

    const item = new ServerModel({ servidor });
    return serversRepository.create(item);
  }

  async update(id, payload) {
    const current = await this.getById(id);
    const servidor = payload?.servidor !== undefined ? String(payload.servidor).trim() : current.servidor;

    if (!servidor) {
      throw new AppError('Campo "servidor" não pode ser vazio', 400);
    }

    return serversRepository.update(id, { servidor });
  }

  async remove(id) {
    await this.getById(id);
    await serversRepository.remove(id);
  }
}

module.exports = new ServersService();
