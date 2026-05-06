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

  async resendWelcome(req, res) {
    if (req.user?.role !== 'admin') {
      throw new AppError('Acesso negado', 403);
    }

    const result = await usersService.resendWelcome({
      adminId: req.user.id,
      clientId: req.params.clientId
    });
    return res.status(200).json(result);
  }
}

module.exports = new UsersController();
