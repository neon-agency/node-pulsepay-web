const clientsService = require('../services/clients.service');

class ClientsController {
  async list(_req, res) {
    const data = await clientsService.list();
    return res.status(200).json(data);
  }

  async getById(req, res) {
    const data = await clientsService.getById(req.params.id);
    return res.status(200).json(data);
  }

  async create(req, res) {
    const data = await clientsService.create(req.body);
    return res.status(201).json(data);
  }

  async update(req, res) {
    const data = await clientsService.update(req.params.id, req.body);
    return res.status(200).json(data);
  }

  async remove(req, res) {
    await clientsService.remove(req.params.id);
    return res.status(200).json({ success: true });
  }
}

module.exports = new ClientsController();
