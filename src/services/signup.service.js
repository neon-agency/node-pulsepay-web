const AppError = require('../errors/app-error');
const { sanitizeTelefone, isValidTelefone } = require('../utils/phone');
const { hashPassword } = require('../utils/password');
const { createId } = require('../utils/id');
const signupIntentsRepository = require('../repositories/signup-intents.repository');
const usersRepository = require('../repositories/users.repository');
const plansService = require('./plans.service');
const botIntegrationsService = require('./bot-integrations.service');
const clientsService = require('./clients.service');
const subscriptionsService = require('./subscriptions.service');

class SignupService {
  getFrontendBaseUrl() {
    return (
      process.env.NANO_GERENCIADOR_BASE_URL
      || process.env.FRONTEND_BASE_URL
      || process.env.APP_BASE_URL
      || 'http://localhost:3000'
    );
  }

  buildStripeReturnUrls({ intentId } = {}) {
    const base = String(this.getFrontendBaseUrl()).replace(/\/+$/, '');
    const id = encodeURIComponent(String(intentId || ''));
    return {
      success_url: `${base}/signup?payment=stripe&result=success&intentId=${id}`,
      cancel_url: `${base}/signup?payment=stripe&result=cancel&intentId=${id}`
    };
  }

  getPixKey() {
    const raw = String(process.env.PIX_KEY || '').trim();
    if (!raw) return null;

    const sanitized = raw.replace(/[^a-fA-F0-9-]/g, '');
    // UUID v4-ish format check (accept generic UUID).
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(sanitized)) {
      return sanitized;
    }

    // Se a chave não for UUID (ex.: chave aleatória/email/telefone), retorna raw sem mexer.
    return raw;
  }

  async createIntent({ name, email, whatsappPhone, password, planId }) {
    const trimmedName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const phone = sanitizeTelefone(whatsappPhone);

    if (!trimmedName || !normalizedEmail || !password || !phone) {
      throw new AppError('Nome, email, WhatsApp e senha são obrigatórios', 400);
    }
    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
      throw new AppError('Email inválido', 400);
    }
    if (!isValidTelefone(phone)) {
      throw new AppError('WhatsApp inválido. Informe entre 10 e 15 dígitos.', 400);
    }
    if (String(password).length < 6) {
      throw new AppError('Senha deve ter ao menos 6 caracteres', 400);
    }

    const existingUser = await usersRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new AppError('Já existe um usuário com este email', 409);
    }

    const plan = await plansService.getById(planId);

    const intent = await signupIntentsRepository.create({
      id: createId('si'),
      name: trimmedName,
      email: normalizedEmail,
      whatsappPhone: phone,
      passwordHash: hashPassword(String(password)),
      planId: plan.id,
      status: 'pending_payment'
    });

    return { intent, plan };
  }

  async getIntent(id) {
    const intent = await signupIntentsRepository.findById(id);
    if (!intent) throw new AppError('Cadastro não encontrado', 404);
    const plan = await plansService.getById(intent.planId).catch(() => null);
    return { intent, plan };
  }

  async startPayment({ intentId, method, customer }) {
    const { intent, plan } = await this.getIntent(intentId);
    if (!plan) throw new AppError('Plano inválido', 400);

    if (intent.status === 'account_created') {
      return { intent, plan, payment: intent.paymentJson ? JSON.parse(intent.paymentJson) : null };
    }

    if (intent.paymentProviderId && intent.paymentJson) {
      return { intent, plan, payment: JSON.parse(intent.paymentJson) };
    }

    const resolvedMethod = String(method || 'pix').trim().toLowerCase();
    const provider = resolvedMethod === 'card' ? 'stripe' : 'efi';

    if (provider === 'stripe' && !plan.stripePriceId) {
      throw new AppError(
        `Plano "${plan.name}" sem STRIPE_PRICE_ID configurado. Defina STRIPE_PRICE_ID_${plan.name.toUpperCase()} no .env do backend.`,
        400
      );
    }

    const cpfDigits = customer?.cpf ? String(customer.cpf).replace(/\D/g, '') : '';
    if (resolvedMethod === 'pix') {
      if (!cpfDigits || cpfDigits.length !== 11) {
        throw new AppError('CPF do devedor é obrigatório para PIX (11 dígitos).', 400);
      }
    }

    const payload = {
      provider,
      method: resolvedMethod,
      amount: plan.priceCents,
      currency: plan.currency || 'BRL',
      description: `Assinatura ${plan.name}`,
      ...(resolvedMethod === 'pix' ? { pix_key: this.getPixKey() } : {}),
      customer: {
        name: intent.name,
        email: intent.email,
        phone: intent.whatsappPhone,
        ...(resolvedMethod === 'pix' ? { cpf: cpfDigits } : {}),
      },
      items: [{ name: `Assinatura ${plan.name}`, value: plan.priceCents, amount: 1 }],
      metadata: {
        kind: 'signup',
        signup_intent_id: intent.id,
        plan_id: plan.id,
        ...(provider === 'stripe' ? { stripe_price_id: plan.stripePriceId } : {}),
        user_email: intent.email,
        ...(provider === 'stripe' ? this.buildStripeReturnUrls({ intentId: intent.id }) : {})
      }
    };

    let payment;
    try {
      payment = await botIntegrationsService.callPaymentApi(payload);
    } catch (error) {
      throw new AppError(`Falha ao iniciar pagamento: ${error instanceof Error ? error.message : 'erro'}`, 502);
    }

    const providerId = payment?.provider_id || payment?.id || null;
    const updated = await signupIntentsRepository.updatePayment(intent.id, {
      paymentProvider: provider,
      paymentProviderId: providerId,
      paymentJson: JSON.stringify(payment || {})
    });

    return { intent: updated, plan, payment };
  }

  async markPaidAndCreateAccount(intentId) {
    const { intent, plan } = await this.getIntent(intentId);
    if (!plan) throw new AppError('Plano inválido', 400);

    if (intent.status === 'account_created') {
      return { ok: true, already: true };
    }

    const existingUser = await usersRepository.findByEmail(intent.email);
    if (existingUser) {
      // Fluxo idempotente: se o usuário já existe, apenas garante assinatura ativa e marca o intent.
      await subscriptionsService.createActiveForUser({ userId: existingUser.id, planId: plan.id });
      await signupIntentsRepository.markAccountCreated(intent.id);
      return { ok: true, already: true, userId: existingUser.id };
    }

    await signupIntentsRepository.markPaid(intent.id);

    // Cria client (revenda) + user + subscription ativa
    const today = new Date();
    const venc = new Date(today);
    venc.setMonth(venc.getMonth() + 1);
    const vencimento = venc.toISOString().slice(0, 10);

    const client = await clientsService.create({
      nome: intent.name,
      email: intent.email,
      telefone: intent.whatsappPhone,
      tipo: 'revenda',
      status: 'ativo',
      vencimento
    });

    const createdUser = await usersRepository.create({
      id: createId(),
      name: intent.name,
      email: intent.email,
      passwordHash: intent.passwordHash,
      role: 'reseller',
      clientId: client.id,
      whatsappPhone: intent.whatsappPhone,
      isActive: true
    });

    await subscriptionsService.createActiveForUser({ userId: createdUser.id, planId: plan.id });

    await signupIntentsRepository.markAccountCreated(intent.id);
    return { ok: true };
  }

  async confirmStripePaymentAndCreateAccount(intentId) {
    const { intent } = await this.getIntent(intentId);

    if (intent.status === 'account_created') {
      return { ok: true, already: true };
    }

    if (String(intent.paymentProvider || '').toLowerCase() !== 'stripe') {
      throw new AppError('Cadastro nao possui pagamento Stripe', 400);
    }

    if (!intent.paymentProviderId) {
      throw new AppError('paymentProviderId nao informado', 400);
    }

    let payment;
    try {
      payment = await botIntegrationsService.getPaymentStatus({ provider: 'stripe', id: intent.paymentProviderId });
    } catch (error) {
      throw new AppError(`Falha ao consultar pagamento no Stripe: ${error instanceof Error ? error.message : 'erro'}`, 502);
    }

    const status = String(payment?.status || '').trim().toLowerCase();
    const isPaid = payment?.paid === true || status === 'paid' || status === 'pago' || status === 'complete' || status === 'completed';

    if (!isPaid) {
      return { ok: true, pending: true, status: payment?.status || null };
    }

    return this.markPaidAndCreateAccount(intent.id);
  }
}

module.exports = new SignupService();
