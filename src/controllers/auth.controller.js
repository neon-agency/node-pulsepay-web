const authService = require('../services/auth.service');

class AuthController {
  login(req, res) {
    const { email, password } = req.body || {};
    const result = authService.login(email, password);

    return res.status(200).json(result);
  }
}

module.exports = new AuthController();
