const AppError = require('../errors/app-error');
const { createId } = require('../utils/id');
const plansService = require('./plans.service');
const userSubscriptionsRepository = require('../repositories/user-subscriptions.repository');
const botIntegrationsService = require('./bot-integrations.service');

class SubscriptionsService {
  getFrontendBaseUrl() {
    return (
      process.env.NANO_GERENCIADOR_BASE_URL
      || process.env.FRONTEND_BASE_URL
      || process.env.APP_BASE_URL
      || 'http://localhost:3000'
    );
  }

  buildStripeReturnUrls({ subscriptionId } = {}) {
    const base = String(this.getFrontendBaseUrl()).replace(/\/+$/, '');
    const sid = encodeURIComponent(String(subscriptionId || ''));
    return {
      success_url: `${base}/reseller/billing?payment=stripe&result=success&subscriptionId=${sid}`,
      cancel_url: `${base}/reseller/billing?payment=stripe&result=cancel&subscriptionId=${sid}`
    };
  }

  getPixKey() {
    const raw = String(process.env.PIX_KEY || '').trim();
    if (!raw) return null;

    const sanitized = raw.replace(/[^a-fA-F0-9-]/g, '');
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(sanitized)) {
      return sanitized;
    }

    return raw;
  }

  getAllowedMethods() {
    const raw = process.env.SUBSCRIPTION_PAYMENT_ALLOWED_METHODS;
    if (!raw) return ['pix', 'card'];
    return String(raw)
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  }

  resolveMethod(requested) {
    const allowed = this.getAllowedMethods();
    const desired = String(requested || process.env.SUBSCRIPTION_PAYMENT_METHOD || 'pix').trim().toLowerCase();
    if (allowed.includes(desired)) return desired;
    return allowed[0] || 'pix';
  }

  resolveProvider({ requestedProvider, method }) {
    const normalizedRequested = String(requestedProvider || '').trim().toLowerCase();
    const normalizedMethod = String(method || '').trim().toLowerCase();

    if (normalizedMethod === 'card') return 'stripe';
    if (normalizedMethod === 'pix') return 'efi';

    return normalizedRequested || String(process.env.SUBSCRIPTION_PAYMENT_PROVIDER || 'efi').trim().toLowerCase();
  }
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

  async createActiveForUser({ userId, planId }) {
    const plan = await plansService.getById(planId);
    return userSubscriptionsRepository.create({
      id: createId('sub'),
      userId,
      planId: plan.id,
      status: 'active',
      activatedAt: new Date().toISOString()
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

  async startPaymentForUser(user, { provider, method, paymentToken, installments, customer } = {}) {
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

    const resolvedMethod = this.resolveMethod(method);
    const resolvedProvider = this.resolveProvider({ requestedProvider: provider, method: resolvedMethod });

    if (resolvedProvider === 'stripe' && !plan.stripePriceId) {
      throw new AppError(
        `Plano "${plan.name}" sem STRIPE_PRICE_ID configurado. Defina STRIPE_PRICE_ID_${plan.name.toUpperCase()} no .env do backend.`,
        400
      );
    }

    const baseCustomer = {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.whatsappPhone || '',
      cpf: '',
      birth: ''
    };

    const mergedCustomer = {
      ...baseCustomer,
      ...(customer && typeof customer === 'object' ? customer : {})
    };

    const payload = {
      provider: resolvedProvider,
      method: resolvedMethod,
      amount: plan.priceCents,
      currency: plan.currency || 'BRL',
      description: `Assinatura ${plan.name}`,
      ...(resolvedMethod === 'pix' ? { pix_key: this.getPixKey() } : {}),
      ...(resolvedMethod === 'card'
        ? {
            payment_token: paymentToken || null,
            installments: Number.isFinite(Number(installments)) ? Number(installments) : 1,
          }
        : {}),
      customer: mergedCustomer,
      items: [{ name: `Assinatura ${plan.name}`, value: plan.priceCents, amount: 1 }],
      metadata: {
        kind: 'subscription',
        subscription_id: current.id,
        plan_id: plan.id,
        ...(resolvedProvider === 'stripe' ? { stripe_price_id: plan.stripePriceId } : {}),
        user_id: user.id,
        user_email: user.email || null,
        ...(resolvedProvider === 'stripe' ? this.buildStripeReturnUrls({ subscriptionId: current.id }) : {})
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
