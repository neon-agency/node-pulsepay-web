const credentialsService = require('../services/credentials.service');
const AppError = require('../errors/app-error');

function ensureAdmin(req) {
  if (req.user?.type === 'internal') return;
  if (req.user?.role !== 'admin') {
    throw new AppError('Acesso negado', 403);
  }
}

async function ensureCredentialAccess(req, credentialId) {
  const credential = await credentialsService.getById(credentialId);

  if (req.user?.type === 'internal') {
    return credential;
  }

  if (req.user?.role === 'reseller' && credential.clientId !== req.user?.clientId) {
    throw new AppError('Acesso negado', 403);
  }

  return credential;
}

class CredentialsController {
  async list(req, res) {
    const clientId = req.user?.role === 'reseller'
      ? req.user?.clientId || null
      : req.query?.clientId || null;
    const data = await credentialsService.list({ clientId });
    return res.status(200).json(data);
  }

  async getById(req, res) {
    const credential = await ensureCredentialAccess(req, req.params.id);
    return res.status(200).json(credential);
  }

  async create(req, res) {
    ensureAdmin(req);
    const data = await credentialsService.create(req.body);
    return res.status(201).json(data);
  }

  async update(req, res) {
    ensureAdmin(req);
    const data = await credentialsService.update(req.params.id, req.body);
    return res.status(200).json(data);
  }

  async remove(req, res) {
    ensureAdmin(req);
    await credentialsService.remove(req.params.id);
    return res.status(204).send();
  }

  async listServers(req, res) {
    await ensureCredentialAccess(req, req.params.id);
    const data = await credentialsService.listServers(req.params.id);
    return res.status(200).json(data);
  }

  async replaceServers(req, res) {
    ensureAdmin(req);
    const data = await credentialsService.replaceServers(req.params.id, req.body?.servers || []);
    return res.status(200).json(data);
  }

  async resolveForBot(req, res) {
    const data = await credentialsService.resolveCredentialWithServers(req.body || {});
    return res.status(200).json(data);
  }
}

module.exports = new CredentialsController();
