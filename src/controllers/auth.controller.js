const authService = require('../services/auth.service');
const clientsService = require('../services/clients.service');
const usersService = require('../services/users.service');
const AppError = require('../errors/app-error');

class AuthController {
  async login(req, res) {
    const { email, password } = req.body || {};
    const result = await authService.login(email, password);

    return res.status(200).json(result);
  }

  async register(req, res) {
    const { name, email, password, whatsappPhone, planId } = req.body || {};

    const trimmedName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const rawPhone = String(whatsappPhone || '').trim();
    const pwd = String(password || '');

    if (!trimmedName || !normalizedEmail || !pwd || !rawPhone) {
      throw new AppError('Nome, email, WhatsApp e senha são obrigatórios', 400);
    }

    // Cria o "client" (revenda) e o usuário vinculado.
    const today = new Date();
    const venc = new Date(today);
    venc.setMonth(venc.getMonth() + 1);
    const vencimento = venc.toISOString().slice(0, 10);

    const client = await clientsService.create({
      nome: trimmedName,
      email: normalizedEmail,
      telefone: rawPhone,
      tipo: 'revenda',
      status: 'ativo',
      vencimento
    });

    await usersService.create({
      name: trimmedName,
      email: normalizedEmail,
      password: pwd,
      role: 'reseller',
      clientId: client.id,
      planId: planId || null
    });

    const result = await authService.login(normalizedEmail, pwd);
    return res.status(201).json(result);
  }

  me(req, res) {
    return res.status(200).json({ user: req.user });
  }
}

module.exports = new AuthController();
