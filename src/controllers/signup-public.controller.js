const signupService = require('../services/signup.service');

class SignupPublicController {
  async createIntent(req, res) {
    const result = await signupService.createIntent(req.body || {});
    return res.status(201).json({
      intent: {
        id: result.intent.id,
        email: result.intent.email,
        whatsappPhone: result.intent.whatsappPhone,
        planId: result.intent.planId,
        status: result.intent.status
      },
      plan: result.plan
    });
  }

  async getIntent(req, res) {
    const { intent, plan } = await signupService.getIntent(req.params.id);
    return res.status(200).json({
      intent: {
        id: intent.id,
        email: intent.email,
        whatsappPhone: intent.whatsappPhone,
        planId: intent.planId,
        status: intent.status,
        paidAt: intent.paidAt || null
      },
      plan
    });
  }

  async startPayment(req, res) {
    const result = await signupService.startPayment({
      intentId: req.params.id,
      method: req.body?.method,
      customer: req.body?.customer
    });
    return res.status(200).json({
      intent: {
        id: result.intent.id,
        status: result.intent.status,
        planId: result.intent.planId
      },
      payment: result.payment
    });
  }

  async confirmStripe(req, res) {
    const result = await signupService.confirmStripePaymentAndCreateAccount(req.params.id);
    return res.status(200).json(result);
  }
}

module.exports = new SignupPublicController();
