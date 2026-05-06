const subscriptionsService = require('../services/subscriptions.service');
const AppError = require('../errors/app-error');

class SubscriptionsController {
  async me(req, res) {
    if (!req.user?.id) {
      throw new AppError('Nao autenticado', 401);
    }
    const current = await subscriptionsService.getCurrentForUser(req.user.id);
    return res.status(200).json(current || { subscription: null, plan: null });
  }

  async start(req, res) {
    if (!req.user?.id) {
      throw new AppError('Nao autenticado', 401);
    }
    const result = await subscriptionsService.startPaymentForUser(req.user);
    return res.status(200).json(result);
  }
}

module.exports = new SubscriptionsController();

