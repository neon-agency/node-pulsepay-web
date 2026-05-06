const AppError = require('../errors/app-error');
const plansRepository = require('../repositories/plans.repository');
const { createId } = require('../utils/id');

class PlansService {
  async ensureDefaults() {
    const existing = await plansRepository.findAllActive();
    if (existing.length > 0) return existing;

    const defaults = [
      { name: 'Basico', priceCents: 2000, currency: 'BRL' },
      { name: 'Pro', priceCents: 5000, currency: 'BRL' }
    ];

    const created = [];
    for (const plan of defaults) {
      created.push(await plansRepository.create({
        id: createId('plan'),
        name: plan.name,
        priceCents: plan.priceCents,
        currency: plan.currency,
        isActive: true
      }));
    }
    return created;
  }

  async listActive() {
    const plans = await plansRepository.findAllActive();
    if (plans.length > 0) return plans;
    return this.ensureDefaults();
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

