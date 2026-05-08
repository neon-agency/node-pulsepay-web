const AppError = require('../errors/app-error');
const plansRepository = require('../repositories/plans.repository');
const { createId } = require('../utils/id');

class PlansService {
  getStripePriceIdFromEnv(planName) {
    if (String(planName || '').trim().toLowerCase().startsWith('teste')) {
      return process.env.STRIPE_PRICE_ID_TESTE || null;
    }

    const key = `STRIPE_PRICE_ID_${String(planName || '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')}`;

    return process.env[key] || null;
  }

  async ensureDefaults() {
    const defaults = [
      { name: 'Mensal', priceCents: 4500, currency: 'BRL' },
      { name: 'Trimestral', priceCents: 11990, currency: 'BRL' },
      { name: 'Semestral', priceCents: 21990, currency: 'BRL' },
      { name: 'Anual', priceCents: 39990, currency: 'BRL' }
    ];

    const testPlanPriceId = process.env.STRIPE_PRICE_ID_TESTE || null;
    const enableTestPlan =
      String(process.env.ENABLE_TEST_PLAN || '').trim().toLowerCase() === 'true'
      || Boolean(testPlanPriceId);

    if (enableTestPlan) {
      defaults.push({ name: 'Teste (R$ 1,00)', priceCents: 100, currency: 'BRL' });
    }

    const ensured = [];
    for (const plan of defaults) {
      const stripePriceId = this.getStripePriceIdFromEnv(plan.name);
      const existing = await plansRepository.findByName(plan.name);
      if (existing) {
        ensured.push(await plansRepository.updateById(existing.id, {
          priceCents: plan.priceCents,
          currency: plan.currency,
          stripePriceId: existing.stripePriceId || stripePriceId,
          isActive: true
        }));
        continue;
      }

      ensured.push(await plansRepository.create({
        id: createId('plan'),
        name: plan.name,
        priceCents: plan.priceCents,
        currency: plan.currency,
        stripePriceId,
        isActive: true
      }));
    }

    // Desativa planos antigos (ex.: Basico/Pro) para o frontend não listar errado.
    await plansRepository.deactivateAllExceptNames(defaults.map((p) => p.name));

    return ensured;
  }

  async listActive() {
    // Sempre reconcilia defaults para evitar ficar preso em planos antigos no DB (Basico/Pro).
    await this.ensureDefaults();

    const plans = await plansRepository.findAllActive();
    // Best-effort: preencher stripe_price_id via ENV (para não depender de UPDATE manual no banco).
    for (const plan of plans) {
      if (plan.stripePriceId) continue;
      const envPriceId = this.getStripePriceIdFromEnv(plan.name);
      if (!envPriceId) continue;
      await plansRepository.updateStripePriceId(plan.id, envPriceId);
      plan.stripePriceId = envPriceId;
    }

    return plans;
  }

  async getById(planId) {
    const plan = await plansRepository.findById(planId);
    if (!plan || !plan.isActive) {
      throw new AppError('Plano nao encontrado', 404);
    }
    return plan;
  }
}

module.exports = new PlansService();
