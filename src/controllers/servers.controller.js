const serversService = require('../services/servers.service');

// Login do servidor é privado do master — só admin/internal pode vê-lo.
function canSeeServerLogin(user) {
  return user?.type === 'internal' || user?.role === 'admin';
}

function stripServerLogin(server) {
  if (!server) return server;
  const { login: _omit, ...rest } = server;
  return rest;
}

class ServersController {
  async list(req, res) {
    const data = await serversService.list();
    const sanitized = canSeeServerLogin(req.user) ? data : data.map(stripServerLogin);
    return res.status(200).json(sanitized);
  }

  async getById(req, res) {
    const data = await serversService.getById(req.params.id);
    const sanitized = canSeeServerLogin(req.user) ? data : stripServerLogin(data);
    return res.status(200).json(sanitized);
  }

  async create(req, res) {
    const data = await serversService.create(req.body);
    return res.status(201).json(data);
  }

  async update(req, res) {
    const data = await serversService.update(req.params.id, req.body);
    return res.status(200).json(data);
  }

  async setPromo(req, res) {
    const data = await serversService.setPromo(req.params.id, req.body);
    return res.status(200).json(data);
  }

  async remove(req, res) {
    await serversService.remove(req.params.id);
    return res.status(200).json({ success: true });
  }
}

module.exports = new ServersController();
