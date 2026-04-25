const pixKeysService = require('../services/pix-keys.service');
const AppError = require('../errors/app-error');

class PixKeysController {
  requireUser(req) {
    if (!req.user?.id) throw new AppError('Usuário inválido', 401);
    return req.user.id;
  }

  async list(req, res) {
    const userId = this.requireUser(req);
    const keys = await pixKeysService.list(userId);
    return res.status(200).json({ pixKeys: keys });
  }

  async create(req, res) {
    const userId = this.requireUser(req);
    const created = await pixKeysService.create(userId, req.body || {});
    return res.status(201).json(created);
  }

  async update(req, res) {
    const userId = this.requireUser(req);
    const updated = await pixKeysService.update(userId, req.params.id, req.body || {});
    return res.status(200).json(updated);
  }

  async remove(req, res) {
    const userId = this.requireUser(req);
    await pixKeysService.remove(userId, req.params.id);
    return res.status(204).send();
  }
}

module.exports = new PixKeysController();
