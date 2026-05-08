const AppError = require('../errors/app-error');
const subscriptionsService = require('../services/subscriptions.service');
const signupService = require('../services/signup.service');

class PaymentWebhookController {
  async handle(req, res) {
    if (!subscriptionsService.validateWebhook(req)) {
      throw new AppError('Acesso negado', 403);
    }

    const payload = req.body || {};
    const metadata = payload?.metadata || {};
    const kind = String(metadata.kind || '').trim().toLowerCase();

    const isPaid = payload?.paid === true
      || String(payload?.paymentStatus || payload?.status || '').trim().toLowerCase() === 'paid'
      || String(payload?.paymentStatus || payload?.status || '').trim().toLowerCase() === 'pago';

    if (kind === 'signup') {
      const intentId = metadata.signup_intent_id || payload?.signup_intent_id;
      if (!intentId) {
        throw new AppError('signup_intent_id nao informado', 400);
      }
      if (!isPaid) {
        return res.status(200).json({ ok: true, ignored: true });
      }
      const result = await signupService.markPaidAndCreateAccount(String(intentId));
      return res.status(200).json(result);
    }

    const result = await subscriptionsService.handlePaymentWebhook(payload);
    return res.status(200).json(result);
  }
}

module.exports = new PaymentWebhookController();
