const noticesService = require('../services/notices.service');

class NoticesController {
  async list(_req, res) {
    const data = await noticesService.list();
    return res.status(200).json(data);
  }

  async listActive(_req, res) {
    const data = await noticesService.listActive();
    return res.status(200).json(data);
  }

  async getById(req, res) {
    const data = await noticesService.getById(req.params.id);
    return res.status(200).json(data);
  }

  async create(req, res) {
    const data = await noticesService.create(req.body, req.user || null);
    return res.status(201).json(data);
  }

  async update(req, res) {
    const data = await noticesService.update(req.params.id, req.body);
    return res.status(200).json(data);
  }

  async remove(req, res) {
    await noticesService.remove(req.params.id);
    return res.status(200).json({ success: true });
  }

  async uploadBanner(req, res) {
    const { mimeType, contentBase64 } = req.body ?? {};
    const data = await noticesService.uploadBanner({ mimeType, contentBase64 });
    return res.status(201).json(data);
  }
}

module.exports = new NoticesController();
