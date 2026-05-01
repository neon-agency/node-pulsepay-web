const authService = require('../services/auth.service');
const pixKeysRepository = require('../repositories/pix-keys.repository');

class AuthController {
  async login(req, res) {
    const { email, password } = req.body || {};
    const result = await authService.login(email, password);

    return res.status(200).json(result);
  }

  async me(req, res) {
    const pixKeys = req.user?.id
      ? await pixKeysRepository.findAllByUser(req.user.id)
      : [];
    return res.status(200).json({ user: req.user, pixKeys });
  }
}

module.exports = new AuthController();
