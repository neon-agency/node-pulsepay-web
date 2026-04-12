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

  parseUrl(value, fallback = null) {
    if (value === undefined || value === null) return fallback;

    const trimmed = String(value).trim();
    if (!trimmed) {
      throw new AppError('Campo "url" é obrigatório', 400);
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(trimmed);
    } catch (error) {
      throw new AppError('Campo "url" deve ser uma URL válida', 400);
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new AppError('Campo "url" deve começar com http:// ou https://', 400);
    }

    return parsedUrl.toString();
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
    const url = this.parseUrl(payload?.url);
    const basePrice = this.parseBasePrice(payload?.basePrice, 10);

    if (!servidor) {
      throw new AppError('Campo "servidor" é obrigatório', 400);
    }

    if (!url) {
      throw new AppError('Campo "url" é obrigatório', 400);
    }

    const item = new ServerModel({ servidor, url, basePrice });
    return serversRepository.create(item);
  }

  async update(id, payload) {
    const current = await this.getById(id);
    const servidor = payload?.servidor !== undefined ? String(payload.servidor).trim() : current.servidor;
    const url = payload?.url !== undefined
      ? this.parseUrl(payload.url)
      : this.parseUrl(current.url, null);
    const basePrice = payload?.basePrice !== undefined
      ? this.parseBasePrice(payload.basePrice)
      : current.basePrice;

    if (!servidor) {
      throw new AppError('Campo "servidor" não pode ser vazio', 400);
    }

    if (!url) {
      throw new AppError('Campo "url" é obrigatório', 400);
    }

    return serversRepository.update(id, { servidor, url, basePrice });
  }

  async remove(id) {
    await this.getById(id);
    await serversRepository.remove(id);
  }
}

module.exports = new ServersService();
