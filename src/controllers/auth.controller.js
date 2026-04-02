const authService = require('../services/auth.service');

class AuthController {
  async login(req, res) {
    const { email, password } = req.body || {};
    const result = await authService.login(email, password);

    return res.status(200).json(result);
  }

  me(req, res) {
    return res.status(200).json({ user: req.user });
  }
}

module.exports = new AuthController();
