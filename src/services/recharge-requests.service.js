const AppError = require('../errors/app-error');
const credentialServersRepository = require('../repositories/credential-servers.repository');

// O fluxo de solicitacao avulsa foi removido. Este modulo permanece apenas como
// helper de precificacao, consumido pelo fluxo de PEDIDOS
// (recharge-orders.service usa `resolvePricing`).
class RechargeRequestsService {
  resolveCatalogPricing(link, quantity) {
    const sortedServerTiers = [...(link?.serverPriceTiers || [])].sort((a, b) => a.quantity - b.quantity);
    if (sortedServerTiers.length === 0) {
      return { effectiveUnit: null, catalogUnit: null, promoUnit: null, isPromo: false };
    }

    const overrideByQuantity = new Map(
      (link?.priceTiersOverride || []).map((tier) => [tier.quantity, tier.unitPrice])
    );
    const promoActive = Boolean(link?.serverPromoActive);
    const promoByQuantity = new Map(
      (link?.serverPromoPriceTiers || []).map((tier) => [tier.quantity, tier.unitPrice])
    );

    const pickTier = () => {
      const exact = sortedServerTiers.find((tier) => tier.quantity === quantity);
      if (exact) return exact;
      const gap = [...sortedServerTiers].reverse().find((tier) => tier.quantity <= quantity);
      return gap ?? sortedServerTiers[0];
    };

    const tier = pickTier();
    const catalogUnit = overrideByQuantity.get(tier.quantity) ?? tier.unitPrice;
    const promoUnit = promoByQuantity.get(tier.quantity) ?? null;
    const isPromo = promoActive && promoUnit !== null;
    const effectiveUnit = isPromo ? promoUnit : catalogUnit;

    return { effectiveUnit, catalogUnit, promoUnit, isPromo };
  }

  resolveCatalogUnitPrice(link, quantity) {
    return this.resolveCatalogPricing(link, quantity).effectiveUnit;
  }

  parseQuantity(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new AppError('Quantidade deve ser um inteiro maior que zero', 400);
    }
    return parsed;
  }

  parseMoney(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new AppError('Valor monetário inválido', 400);
    }
    return Number(parsed.toFixed(2));
  }

  async resolvePricing({ credentialId, serverId, quantity, unitPrice }) {
    if (unitPrice !== undefined && unitPrice !== null) {
      return {
        unitPrice: this.parseMoney(unitPrice),
        isPromo: false,
        promoUnitPrice: null,
        catalogUnitPrice: null
      };
    }

    const link = await credentialServersRepository.findOneByCredentialAndServer(credentialId, serverId);
    if (!link || !link.isActive) {
      throw new AppError('Credencial não está vinculada ao servidor informado', 400);
    }

    if (link.priceOverride !== null) {
      return {
        unitPrice: this.parseMoney(link.priceOverride),
        isPromo: false,
        promoUnitPrice: null,
        catalogUnitPrice: this.parseMoney(link.priceOverride)
      };
    }

    const pricing = this.resolveCatalogPricing(link, quantity);
    if (pricing.effectiveUnit !== null) {
      return {
        unitPrice: this.parseMoney(pricing.effectiveUnit),
        isPromo: pricing.isPromo,
        promoUnitPrice: pricing.promoUnit !== null ? this.parseMoney(pricing.promoUnit) : null,
        catalogUnitPrice: pricing.catalogUnit !== null ? this.parseMoney(pricing.catalogUnit) : null
      };
    }

    const fallback = link.basePrice;
    return {
      unitPrice: this.parseMoney(fallback),
      isPromo: false,
      promoUnitPrice: null,
      catalogUnitPrice: this.parseMoney(fallback)
    };
  }

  async resolvePrice(args) {
    const { unitPrice } = await this.resolvePricing(args);
    return unitPrice;
  }
}

module.exports = new RechargeRequestsService();
