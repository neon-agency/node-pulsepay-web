const usersService = require('../services/users.service');
const AppError = require('../errors/app-error');

class UsersController {
  async create(req, res) {
    if (req.user?.role !== 'admin') {
      throw new AppError('Acesso negado', 403);
    }

    const { name, email, password, clientId } = req.body || {};
    const user = await usersService.create({ name, email, password, role: 'reseller', clientId });
    return res.status(201).json(usersService.toPublicUser(user));
  }
}

module.exports = new UsersController();
