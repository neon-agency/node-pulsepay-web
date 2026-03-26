const credentialsService = require('../services/credentials.service');

class CredentialsController {
  async list(_req, res) {
    const data = await credentialsService.list();
    return res.status(200).json(data);
  }

  async getById(req, res) {
    const data = await credentialsService.getById(req.params.id);
    return res.status(200).json(data);
  }

  async create(req, res) {
    const data = await credentialsService.create(req.body);
    return res.status(201).json(data);
  }

  async update(req, res) {
    const data = await credentialsService.update(req.params.id, req.body);
    return res.status(200).json(data);
  }

  async remove(req, res) {
    await credentialsService.remove(req.params.id);
    return res.status(204).send();
  }

  async listServers(req, res) {
    const data = await credentialsService.listServers(req.params.id);
    return res.status(200).json(data);
  }

  async replaceServers(req, res) {
    const data = await credentialsService.replaceServers(req.params.id, req.body?.servers || []);
    return res.status(200).json(data);
  }

  async resolveForBot(req, res) {
    const data = await credentialsService.resolveCredentialWithServers(req.body || {});
    return res.status(200).json(data);
  }
}

module.exports = new CredentialsController();
