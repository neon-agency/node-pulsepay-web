const serversService = require('../services/servers.service');

class ServersController {
  async list(_req, res) {
    const data = await serversService.list();
    return res.status(200).json(data);
  }

  async getById(req, res) {
    const data = await serversService.getById(req.params.id);
    return res.status(200).json(data);
  }

  async create(req, res) {
    const data = await serversService.create(req.body);
    return res.status(201).json(data);
  }

  async update(req, res) {
    const data = await serversService.update(req.params.id, req.body);
    return res.status(200).json(data);
  }

  async remove(req, res) {
    await serversService.remove(req.params.id);
    return res.status(200).json({ success: true });
  }
}

module.exports = new ServersController();
