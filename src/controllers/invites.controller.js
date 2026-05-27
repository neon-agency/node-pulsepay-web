const invitesService = require('../services/invites.service');

class InvitesController {
  async create(req, res) {
    const data = await invitesService.create({
      adminId: req.user?.id,
      expiresInDays: req.body?.expiresInDays
    });
    return res.status(201).json(data);
  }

  async list(req, res) {
    const data = await invitesService.list({ adminId: req.user?.id });
    return res.status(200).json(data);
  }

  async revoke(req, res) {
    if (req.query?.hard === '1' || req.query?.hard === 'true') {
      const data = await invitesService.hardDelete({
        adminId: req.user?.id,
        id: req.params.id
      });
      return res.status(200).json(data);
    }
    const data = await invitesService.revoke({
      adminId: req.user?.id,
      id: req.params.id,
      userId: req.user?.id
    });
    return res.status(200).json(data);
  }

  async renew(req, res) {
    const data = await invitesService.renew({
      adminId: req.user?.id,
      id: req.params.id,
      expiresInDays: req.body?.expiresInDays
    });
    return res.status(200).json(data);
  }

  async getPublic(req, res) {
    const data = await invitesService.getPublicByToken(req.params.token);
    return res.status(200).json(data);
  }

  async signupFromInvite(req, res) {
    const data = await invitesService.consumeAndSignup({
      plainToken: req.body?.inviteToken,
      name: req.body?.name,
      email: req.body?.email,
      password: req.body?.password,
      whatsappPhone: req.body?.whatsappPhone
    });
    return res.status(200).json(data);
  }
}

module.exports = new InvitesController();
