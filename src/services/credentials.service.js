const AppError = require('../errors/app-error');
const CredentialModel = require('../models/credential.model');
const CredentialServerModel = require('../models/credential-server.model');
const credentialsRepository = require('../repositories/credentials.repository');
const credentialServersRepository = require('../repositories/credential-servers.repository');
const serversRepository = require('../repositories/servers.repository');
const clientsRepository = require('../repositories/clients.repository');
const {
  normalizeCredentialName,
  sanitizeLast4,
  buildCredentialKey
} = require('../utils/credential');

class CredentialsService {
  parsePrice(value) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new AppError('Preço deve ser um número maior ou igual a zero', 400);
    }
    return Number(parsed.toFixed(2));
  }

  normalizeCredentialPayload(payload, current = null) {
    const nome = payload?.nome !== undefined ? String(payload.nome).trim() : current?.nome;
    const last4Raw = payload?.last4 !== undefined ? payload.last4 : current?.last4;
    const last4 = sanitizeLast4(last4Raw);
    const nomeNormalized = normalizeCredentialName(nome);
    const credentialKey = buildCredentialKey(nomeNormalized, last4);
    const clientIdRaw =
      payload?.clientId !== undefined
        ? String(payload.clientId).trim()
        : current?.clientId;
    const clientId = clientIdRaw || null;

    if (!nome) {
      throw new AppError('Campo "nome" é obrigatório', 400);
    }

    if (last4.length !== 4) {
      throw new AppError('Campo "last4" deve conter 4 dígitos', 400);
    }

    if (!clientId) {
      throw new AppError('Campo "clientId" é obrigatório (credencial vinculada ao cliente)', 400);
    }

    return {
      nome,
      last4,
      nomeNormalized,
      credentialKey,
      clientId
    };
  }

  normalizeLinkPayload(payload) {
    const serverId = String(payload?.serverId || '').trim();
    if (!serverId) {
      throw new AppError('Cada vínculo precisa de "serverId"', 400);
    }

    return {
      serverId,
      priceOverride: this.parsePrice(payload?.priceOverride),
      isActive: payload?.isActive !== false
    };
  }

  async list() {
    return credentialsRepository.findAll();
  }

  async getById(id) {
    const data = await credentialsRepository.findById(id);
    if (!data) throw new AppError('Credencial não encontrada', 404);
    return data;
  }

  async create(payload) {
    const data = this.normalizeCredentialPayload(payload);
    const client = await clientsRepository.findById(data.clientId);
    if (!client) {
      throw new AppError('Cliente não encontrado', 400);
    }

    const duplicated = await credentialsRepository.findByClientIdAndCredentialKey(
      data.clientId,
      data.credentialKey
    );
    if (duplicated) {
      throw new AppError('Este cliente já possui credencial com esse nome e últimos 4 dígitos', 409);
    }

    return credentialsRepository.create(new CredentialModel(data));
  }

  async update(id, payload) {
    const current = await this.getById(id);
    const data = this.normalizeCredentialPayload(payload, current);
    const client = await clientsRepository.findById(data.clientId);
    if (!client) {
      throw new AppError('Cliente não encontrado', 400);
    }

    const duplicated = await credentialsRepository.findByClientIdAndCredentialKey(
      data.clientId,
      data.credentialKey
    );
    if (duplicated && duplicated.id !== id) {
      throw new AppError('Este cliente já possui credencial com esse nome e últimos 4 dígitos', 409);
    }

    return credentialsRepository.update(id, data);
  }

  async remove(id) {
    await this.getById(id);
    await credentialsRepository.remove(id);
  }

  async listServers(credentialId) {
    await this.getById(credentialId);
    const links = await credentialServersRepository.findByCredentialIdWithServers(credentialId);
    return links.map((link) => ({
      ...link,
      effectivePrice: link.priceOverride === null ? link.basePrice : link.priceOverride
    }));
  }

  async replaceServers(credentialId, linksPayload) {
    await this.getById(credentialId);
    if (!Array.isArray(linksPayload)) {
      throw new AppError('O campo "servers" deve ser uma lista', 400);
    }

    const normalized = linksPayload.map((item) => this.normalizeLinkPayload(item));
    const uniqueServerIds = new Set();
    for (const item of normalized) {
      if (uniqueServerIds.has(item.serverId)) {
        throw new AppError(`Servidor duplicado no vínculo: ${item.serverId}`, 400);
      }
      uniqueServerIds.add(item.serverId);
    }

    const servers = await serversRepository.findAll();
    const validServerIds = new Set(servers.map((server) => String(server.id)));
    for (const item of normalized) {
      if (!validServerIds.has(item.serverId)) {
        throw new AppError(`Servidor não encontrado: ${item.serverId}`, 400);
      }
    }

    const rows = normalized.map((item) => new CredentialServerModel({
      credentialId,
      serverId: item.serverId,
      priceOverride: item.priceOverride,
      isActive: item.isActive
    }));

    await credentialServersRepository.replaceAll(credentialId, rows);
    return this.listServers(credentialId);
  }

  async resolveCredentialWithServers(payload) {
    const nome = String(payload?.nome || '').trim();
    const last4 = sanitizeLast4(payload?.last4);

    if (!nome || last4.length !== 4) {
      throw new AppError('Informe nome e 4 últimos dígitos válidos', 400);
    }

    const key = buildCredentialKey(normalizeCredentialName(nome), last4);
    const matches = await credentialsRepository.findAllByCredentialKey(key);
    if (matches.length === 0) {
      throw new AppError('Credencial não encontrada', 404);
    }
    if (matches.length > 1) {
      throw new AppError(
        'Existem várias credenciais com esse nome e últimos dígitos; contate o suporte.',
        409
      );
    }

    const credential = matches[0];
    const client = await clientsRepository.findById(credential.clientId);
    if (!client) {
      throw new AppError('Cliente da credencial não encontrado', 500);
    }

    const links = await credentialServersRepository.findByCredentialIdWithServers(credential.id);
    const activeLinks = links
      .filter((link) => link.isActive)
      .map((link) => ({
        id: link.id,
        serverId: link.serverId,
        servidor: link.servidor,
        basePrice: link.basePrice,
        priceOverride: link.priceOverride,
        effectivePrice: link.priceOverride === null ? link.basePrice : link.priceOverride
      }));

    return {
      credential: {
        id: credential.id,
        nome: credential.nome,
        last4: credential.last4,
        clientId: client.id
      },
      client: {
        id: client.id,
        nome: client.nome,
        telefone: client.telefone
      },
      servers: activeLinks
    };
  }
}

module.exports = new CredentialsService();
