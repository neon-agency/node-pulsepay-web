const usersService = require('../services/users.service');
const AppError = require('../errors/app-error');

class UsersController {
  async create(req, res) {
    if (req.user?.role !== 'admin') {
      throw new AppError('Acesso negado', 403);
    }

    const { name, email, password, clientId } = req.body || {};
    const user = await usersService.create({ name, email, password, role: 'reseller', clientId, adminId: req.user.id });
    return res.status(201).json(usersService.toPublicUser(user));
  }

  async setActive(req, res) {
    if (req.user?.role !== 'admin') {
      throw new AppError('Acesso negado', 403);
    }

    const { isActive } = req.body || {};
    const user = await usersService.setActiveByClientId({
      adminId: req.user.id,
      clientId: req.params.clientId,
      isActive
    });
    return res.status(200).json(user);
  }

  async updatePassword(req, res) {
    if (req.user?.role !== 'admin') {
      throw new AppError('Acesso negado', 403);
    }

    const { password } = req.body || {};
    const user = await usersService.updatePasswordByClientId({
      adminId: req.user.id,
      clientId: req.params.clientId,
      password
    });
    return res.status(200).json(user);
  }
}

module.exports = new UsersController();
