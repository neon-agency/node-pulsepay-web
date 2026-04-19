const AppError = require('../errors/app-error');
const ClientModel = require('../models/client.model');
const clientsRepository = require('../repositories/clients.repository');
const serversRepository = require('../repositories/servers.repository');
const { sanitizeTelefone, isValidTelefone } = require('../utils/phone');

function toDateOnlyString(dateInput) {
  const input = new Date(dateInput);
  if (Number.isNaN(input.getTime())) {
    throw new AppError('Campo "vencimento" deve ser uma data válida', 400);
  }

  const year = input.getUTCFullYear();
  const month = String(input.getUTCMonth() + 1).padStart(2, '0');
  const day = String(input.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function calculateStatusVencimento(vencimento) {
  const target = new Date(vencimento);
  target.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((target.getTime() - today.getTime()) / msPerDay);

  if (diffDays <= 3) return 'critico';
  if (diffDays <= 7) return 'atencao';
  return 'ok';
}

function normalizeTipo(tipoValue) {
  const tipo = String(tipoValue || '').trim().toLowerCase();

  if (!tipo) return '';
  if (tipo === 'servidor') return 'revenda';

  return tipo;
}

async function normalizePayload(payload, current = null) {
  const nome = payload?.nome !== undefined ? String(payload.nome).trim() : current?.nome;
  const email = payload?.email !== undefined ? String(payload.email).trim().toLowerCase() : current?.email;
  const telefoneRaw =
    payload?.telefone !== undefined ? payload.telefone : current?.telefone;
  const telefone = sanitizeTelefone(telefoneRaw);
  const tipoRaw = payload?.tipo !== undefined ? payload.tipo : current?.tipo;
  const tipo = normalizeTipo(tipoRaw);
  const servidor = payload?.servidor !== undefined ? String(payload.servidor).trim() : current?.servidor;
  const plano = payload?.plano !== undefined ? String(payload.plano).trim() : current?.plano;
  const status = payload?.status !== undefined ? String(payload.status).trim().toLowerCase() : current?.status;
  const vencimentoRaw = payload?.vencimento !== undefined ? String(payload.vencimento).trim() : current?.vencimento;

  if (!nome) throw new AppError('Campo "nome" é obrigatório', 400);
  if (!email) throw new AppError('Campo "email" é obrigatório', 400);
  if (!isValidTelefone(telefone)) {
    throw new AppError('Campo "telefone" é obrigatório (mín. 10 dígitos)', 400);
  }
  if (!tipo) throw new AppError('Campo "tipo" é obrigatório', 400);
  if (!status) throw new AppError('Campo "status" é obrigatório', 400);
  if (!vencimentoRaw) throw new AppError('Campo "vencimento" é obrigatório', 400);

  const allowedStatus = ['ativo', 'inativo', 'suspenso'];
  if (!allowedStatus.includes(status)) {
    throw new AppError('Campo "status" deve ser: ativo, inativo ou suspenso', 400);
  }

  const allowedTipos = ['cliente', 'revenda'];
  if (!allowedTipos.includes(tipo)) {
    throw new AppError('Campo "tipo" deve ser: cliente ou revenda', 400);
  }

  const requiresServer = tipo === 'cliente';

  if (requiresServer && !servidor) {
    throw new AppError('Campo "servidor" é obrigatório', 400);
  }

  if (requiresServer && !plano) {
    throw new AppError('Campo "plano" é obrigatório', 400);
  }

  if (requiresServer) {
    const server = await serversRepository.findById(servidor);
    if (!server) {
      throw new AppError('Servidor informado não existe', 400);
    }
  }

  const vencimento = toDateOnlyString(vencimentoRaw);
  const statusVencimento = calculateStatusVencimento(vencimento);

  return {
    nome,
    email,
    telefone,
    tipo,
    servidor: requiresServer ? servidor : null,
    plano: requiresServer ? plano : null,
    status,
    vencimento,
    statusVencimento
  };
}

class ClientsService {
  async list(query = {}) {
    const tipo = normalizeTipo(query?.tipo);
    if (!tipo) {
      return clientsRepository.findAll();
    }

    const allowedTipos = ['cliente', 'revenda'];
    if (!allowedTipos.includes(tipo)) {
      throw new AppError('Query "tipo" deve ser: cliente ou revenda', 400);
    }

    return clientsRepository.findAll({ tipo });
  }

  async getById(id) {
    const client = await clientsRepository.findById(id);
    if (!client) {
      throw new AppError('Cliente não encontrado', 404);
    }

    return client;
  }

  async create(payload) {
    const data = await normalizePayload(payload);

    const duplicated = await clientsRepository.findByEmail(data.email);
    if (duplicated) {
      throw new AppError('Já existe cliente com esse email', 409);
    }

    const item = new ClientModel(data);
    return clientsRepository.create(item);
  }

  async update(id, payload) {
    const current = await this.getById(id);
    const data = await normalizePayload(payload, current);

    const duplicated = await clientsRepository.findByEmail(data.email);
    if (duplicated && duplicated.id !== current.id) {
      throw new AppError('Já existe cliente com esse email', 409);
    }

    return clientsRepository.update(current.id, data);
  }

  async remove(id) {
    const client = await this.getById(id);
    await clientsRepository.remove(client.id);
  }
}

module.exports = new ClientsService();
