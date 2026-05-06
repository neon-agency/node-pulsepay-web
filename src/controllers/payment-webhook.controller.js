const AppError = require('../errors/app-error');
const subscriptionsService = require('../services/subscriptions.service');

class PaymentWebhookController {
  async handle(req, res) {
    if (!subscriptionsService.validateWebhook(req)) {
      throw new AppError('Acesso negado', 403);
    }

    const payload = req.body || {};
    const result = await subscriptionsService.handlePaymentWebhook(payload);
    return res.status(200).json(result);
  }
}

module.exports = new PaymentWebhookController();

