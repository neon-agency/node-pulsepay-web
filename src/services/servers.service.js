const AppError = require('../errors/app-error');
const ServerModel = require('../models/server.model');
const serversRepository = require('../repositories/servers.repository');

class ServersService {
  parsePriceTiers(value, fallback = []) {
    if (value === undefined || value === null) {
      return Array.isArray(fallback) ? fallback : [];
    }

    if (!Array.isArray(value) || value.length === 0) {
      throw new AppError('Campo "priceTiers" deve ser uma lista com ao menos um item', 400);
    }

    const normalized = value
      .map((tier) => ({
        quantity: Number(tier?.quantity),
        unitPrice: Number(tier?.unitPrice ?? tier?.unit_price)
      }))
      .map((tier) => ({
        quantity: Number.isFinite(tier.quantity) ? Math.trunc(tier.quantity) : NaN,
        unitPrice: Number.isFinite(tier.unitPrice) ? Number(tier.unitPrice.toFixed(2)) : NaN
      }));

    if (normalized.some((tier) => !Number.isFinite(tier.quantity) || tier.quantity <= 0 || !Number.isFinite(tier.unitPrice) || tier.unitPrice <= 0)) {
      throw new AppError('Cada item de "priceTiers" precisa ter quantity e unitPrice maiores que zero', 400);
    }

    const uniqueQuantities = new Set(normalized.map((tier) => tier.quantity));
    if (uniqueQuantities.size !== normalized.length) {
      throw new AppError('Campo "priceTiers" não pode repetir quantity', 400);
    }

    return normalized.sort((a, b) => a.quantity - b.quantity);
  }

  parseBasePrice(value, fallback = null) {
    if (value === undefined || value === null || value === '') return fallback;

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new AppError('Campo "basePrice" deve ser um número maior ou igual a zero', 400);
    }

    return Number(parsed.toFixed(2));
  }

  parseCustoCredito(value, fallback = 0) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new AppError('Campo "custoCredito" deve ser um número maior ou igual a zero', 400);
    }
    return Number(parsed.toFixed(2));
  }

  parseEstoque(value, fallback = 0) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Math.trunc(Number(value));
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new AppError('Campo "estoque" deve ser um inteiro maior ou igual a zero', 400);
    }
    return parsed;
  }

  parseEstoqueAlerta(value, fallback = null) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Math.trunc(Number(value));
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new AppError('Campo "estoqueAlerta" deve ser um inteiro maior ou igual a zero', 400);
    }
    return parsed;
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
    const priceTiers = this.parsePriceTiers(payload?.priceTiers, []);
    const basePrice = this.parseBasePrice(payload?.basePrice, priceTiers[0]?.unitPrice ?? 10);

    if (!servidor) {
      throw new AppError('Campo "servidor" é obrigatório', 400);
    }

    if (!url) {
      throw new AppError('Campo "url" é obrigatório', 400);
    }

    const custoCredito = this.parseCustoCredito(payload?.custoCredito, 0);
    const estoque = this.parseEstoque(payload?.estoque, 0);
    const estoqueAlerta = this.parseEstoqueAlerta(payload?.estoqueAlerta, null);

    const item = new ServerModel({ servidor, url, basePrice, priceTiers, custoCredito, estoque, estoqueAlerta });
    return serversRepository.create(item);
  }

  async update(id, payload) {
    const current = await this.getById(id);
    const servidor = payload?.servidor !== undefined ? String(payload.servidor).trim() : current.servidor;
    const url = payload?.url !== undefined
      ? this.parseUrl(payload.url)
      : this.parseUrl(current.url, null);
    const priceTiers = payload?.priceTiers !== undefined
      ? this.parsePriceTiers(payload.priceTiers, current.priceTiers)
      : current.priceTiers;
    const basePrice = payload?.basePrice !== undefined
      ? this.parseBasePrice(payload.basePrice, priceTiers[0]?.unitPrice ?? current.basePrice)
      : (priceTiers[0]?.unitPrice ?? current.basePrice);

    if (!servidor) {
      throw new AppError('Campo "servidor" não pode ser vazio', 400);
    }

    if (!url) {
      throw new AppError('Campo "url" é obrigatório', 400);
    }

    const custoCredito = payload?.custoCredito !== undefined
      ? this.parseCustoCredito(payload.custoCredito, current.custoCredito)
      : current.custoCredito;
    const estoque = payload?.estoque !== undefined
      ? this.parseEstoque(payload.estoque, current.estoque)
      : current.estoque;
    const estoqueAlerta = payload?.estoqueAlerta !== undefined
      ? this.parseEstoqueAlerta(payload.estoqueAlerta, current.estoqueAlerta)
      : current.estoqueAlerta;

    return serversRepository.update(id, { servidor, url, basePrice, priceTiers, custoCredito, estoque, estoqueAlerta });
  }

  async remove(id) {
    await this.getById(id);
    await serversRepository.remove(id);
  }
}

module.exports = new ServersService();
