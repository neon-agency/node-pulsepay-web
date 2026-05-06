const AppError = require('../errors/app-error');
const { createId } = require('../utils/id');
const plansService = require('./plans.service');
const userSubscriptionsRepository = require('../repositories/user-subscriptions.repository');
const botIntegrationsService = require('./bot-integrations.service');

class SubscriptionsService {
  getWebhookSecret() {
    return process.env.PAYMENT_WEBHOOK_SECRET || process.env.INTERNAL_API_KEY || null;
  }

  validateWebhook(req) {
    const secret = this.getWebhookSecret();
    if (!secret) return true;
    const provided = req.headers['x-webhook-secret'];
    return provided === secret;
  }

  async createPendingForUser({ userId, planId }) {
    const plan = await plansService.getById(planId);
    return userSubscriptionsRepository.create({
      id: createId('sub'),
      userId,
      planId: plan.id,
      status: 'pending'
    });
  }

  async getCurrentForUser(userId) {
    const subscription = await userSubscriptionsRepository.findLatestByUserId(userId);
    if (!subscription) {
      return null;
    }
    const plan = await plansService.getById(subscription.planId).catch(() => null);
    return { subscription, plan };
  }

  async startPaymentForUser(user) {
    if (!user?.id) {
      throw new AppError('Usuario invalido', 401);
    }

    const current = await userSubscriptionsRepository.findLatestByUserId(user.id);
    if (!current) {
      throw new AppError('Assinatura nao encontrada para o usuario', 404);
    }
    if (current.status === 'active') {
      return { subscription: current, payment: current.paymentJson ? JSON.parse(current.paymentJson) : null };
    }

    if (current.paymentProvider && current.paymentProviderId && current.paymentJson) {
      return { subscription: current, payment: JSON.parse(current.paymentJson) };
    }

    const plan = await plansService.getById(current.planId);

    const payload = {
      provider: process.env.SUBSCRIPTION_PAYMENT_PROVIDER || 'efi',
      method: process.env.SUBSCRIPTION_PAYMENT_METHOD || 'pix',
      amount: plan.priceCents,
      currency: plan.currency || 'BRL',
      description: `Assinatura ${plan.name}`,
      metadata: {
        kind: 'subscription',
        subscription_id: current.id,
        plan_id: plan.id,
        user_id: user.id,
        user_email: user.email || null
      }
    };

    let payment;
    try {
      payment = await botIntegrationsService.callPaymentApi(payload);
    } catch (error) {
      throw new AppError(`Falha ao iniciar pagamento: ${error instanceof Error ? error.message : 'erro'}`, 502);
    }

    const providerId = payment?.provider_id || payment?.id || null;
    const updated = await userSubscriptionsRepository.updatePayment(current.id, {
      paymentProvider: payload.provider,
      paymentProviderId: providerId,
      paymentJson: JSON.stringify(payment || {})
    });

    return { subscription: updated, payment };
  }

  async handlePaymentWebhook(payload) {
    const status = String(payload?.paymentStatus || payload?.status || '').trim().toLowerCase();
    const isPaid = payload?.paid === true || status === 'paid' || status === 'pago';

    const metadata = payload?.metadata || {};
    const subscriptionId = metadata.subscription_id || payload?.subscription_id;
    if (!subscriptionId) {
      throw new AppError('subscription_id nao informado', 400);
    }

    if (!isPaid) {
      return { ok: true, ignored: true };
    }

    const updated = await userSubscriptionsRepository.markActive(String(subscriptionId));
    return { ok: true, subscription: updated };
  }
}

module.exports = new SubscriptionsService();

