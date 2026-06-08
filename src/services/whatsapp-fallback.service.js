const paymentProofNotificationsService = require('./payment-proof-notifications.service');
const salesNotificationsService = require('./sales-notifications.service');
const paymentProofsService = require('./payment-proofs.service');
const rechargeRequestsService = require('./recharge-requests.service');
const rechargeOrdersRepository = require('../repositories/recharge-orders.repository');
const usersRepository = require('../repositories/users.repository');
const whiteLabelRepository = require('../repositories/white-label.repository');
const { sanitizeTelefone, isValidTelefone } = require('../utils/phone');

const DEFAULT_BRAND_NAME = 'PulsePay';

async function resolveBrandName(adminId) {
  if (!adminId) return DEFAULT_BRAND_NAME;
  try {
    const wl = await whiteLabelRepository.findByUserId(adminId);
    const name = wl?.systemName ? String(wl.systemName).trim() : '';
    return name || DEFAULT_BRAND_NAME;
  } catch (_error) {
    return DEFAULT_BRAND_NAME;
  }
}

/**
 * Manual WhatsApp fallback: rebuilds the EXACT same message the bot (GO-zap-service)
 * would have sent and returns ready-to-use wa.me deep links, so a human can deliver
 * it by hand when the bot fails. Does not send anything itself.
 *
 * Reseller side ("request"/order request): solicitação -> master.
 * Master side ("paid"/"rejected"): resultado da análise -> revendedor.
 */
class WhatsAppFallbackService {
  buildWaLink(phone, message) {
    let digits = sanitizeTelefone(phone);
    if (!digits) return null;
    // wa.me needs full international MSISDN. Assume BR (55) when missing.
    if (!digits.startsWith('55') && digits.length <= 11) {
      digits = `55${digits}`;
    }
    if (!isValidTelefone(digits)) return null;
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }

  buildTarget({ id, name, phone, message }) {
    const link = this.buildWaLink(phone, message);
    if (!link) return null;
    return { id: id || null, name: name || null, phone: phone || null, message, link };
  }

  // Resolve the reseller user(s) tied to an order (never admins).
  async resolveOrderReseller(order) {
    const byId = new Map();
    const addUser = (user) => {
      if (!user || !user.isActive || !user.whatsappPhone) return;
      if (user.role === 'admin') return;
      byId.set(user.id, user);
    };

    if (order.createdByUserId) {
      addUser(await usersRepository.findById(order.createdByUserId));
    }
    if (order.clientId) {
      try {
        const resellers = await usersRepository.findActiveByClientIdWithWhatsapp(order.clientId);
        resellers.forEach(addUser);
      } catch (error) {
        console.error('Falha ao buscar revendedores do pedido para fallback:', error);
      }
    }

    return Array.from(byId.values());
  }

  buildOrderPaidMessage({ order, items, recipient, brandName }) {
    const dataHora = new Date(order.updatedAt || order.createdAt || Date.now())
      .toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const valor = Number(order.totalAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const brand = (brandName || DEFAULT_BRAND_NAME).toUpperCase();

    const lines = [
      'Recarga concluída com sucesso ✅',
      '',
      `Olá ${recipient?.name || '-'},`,
      'Seu pedido foi efetivado.',
      '',
      `Pedido: ${order.id}`,
      `Itens: ${items.length}`,
      ''
    ];

    items.forEach((item, index) => {
      lines.push(
        `${index + 1}) ${item.servidor || item.serverName || '-'}`,
        `   Login: ${item.accountLogin}`,
        `   Quantidade: ${item.quantity}`
      );
    });

    lines.push('', `Valor total: ${valor}`, '', `Data/Hora: ${dataHora}`, '', `EQUIPE ${brand} AGRADECE!`);

    return lines.join('\n');
  }

  // === Flow 1: solicitação -> master (acionado pelo REVENDEDOR no pagamento) ===

  async requestFallback(rechargeRequestId) {
    const { recharge, proof } = await paymentProofsService.getLatestByRechargeRequestId(rechargeRequestId);
    const admins = await usersRepository.findAllAdminsWithWhatsapp();

    const targets = [];
    for (const admin of admins) {
      const brandName = await resolveBrandName(admin.id);
      const message = paymentProofNotificationsService.buildMessage({ recharge, proof, brandName });
      const target = this.buildTarget({ id: admin.id, name: admin.name, phone: admin.whatsappPhone, message });
      if (target) targets.push(target);
    }

    return { kind: 'request', targets };
  }

  async orderRequestFallback(rechargeOrderId) {
    const { order, proof } = await paymentProofsService.getLatestForOrder(rechargeOrderId);
    const items = await rechargeOrdersRepository.findItemsByOrderId(order.id);
    const admins = await usersRepository.findAllAdminsWithWhatsapp();

    const targets = [];
    for (const admin of admins) {
      const brandName = await resolveBrandName(admin.id);
      const message = paymentProofNotificationsService.buildOrderMessage({ order, items, proof, brandName });
      const target = this.buildTarget({ id: admin.id, name: admin.name, phone: admin.whatsappPhone, message });
      if (target) targets.push(target);
    }

    return { kind: 'order_request', targets };
  }

  // === Flow 2: resultado da análise -> revendedor (acionado pelo MASTER ao aprovar/rejeitar) ===

  async paidFallback(rechargeRequestId) {
    const recharge = await rechargeRequestsService.getById(rechargeRequestId);
    const recipients = await salesNotificationsService.resolveRecipients(recharge);

    const targets = [];
    for (const recipient of recipients) {
      const brandName = await resolveBrandName(recipient.adminId);
      const message = salesNotificationsService.buildMessage(recharge, recipient, brandName);
      const target = this.buildTarget({ id: recipient.id, name: recipient.name, phone: recipient.whatsappPhone, message });
      if (target) targets.push(target);
    }

    return { kind: 'paid', targets };
  }

  async rejectedFallback(rechargeRequestId) {
    const recharge = await rechargeRequestsService.getById(rechargeRequestId);
    const recipients = await salesNotificationsService.resolveRecipients(recharge);
    const message = paymentProofsService.buildCustomerRejectedMessage(recharge);

    const targets = [];
    for (const recipient of recipients) {
      const target = this.buildTarget({ id: recipient.id, name: recipient.name, phone: recipient.whatsappPhone, message });
      if (target) targets.push(target);
    }

    return { kind: 'rejected', targets };
  }

  async orderPaidFallback(rechargeOrderId) {
    const { order } = await paymentProofsService.getLatestForOrder(rechargeOrderId);
    const items = await rechargeOrdersRepository.findItemsByOrderId(order.id);
    const recipients = await this.resolveOrderReseller(order);

    const targets = [];
    for (const recipient of recipients) {
      const brandName = await resolveBrandName(recipient.adminId);
      const message = this.buildOrderPaidMessage({ order, items, recipient, brandName });
      const target = this.buildTarget({ id: recipient.id, name: recipient.name, phone: recipient.whatsappPhone, message });
      if (target) targets.push(target);
    }

    return { kind: 'order_paid', targets };
  }

  async orderRejectedFallback(rechargeOrderId) {
    const { order } = await paymentProofsService.getLatestForOrder(rechargeOrderId);
    const recipients = await this.resolveOrderReseller(order);
    const message = paymentProofsService.buildCustomerRejectedMessage(order);

    const targets = [];
    for (const recipient of recipients) {
      const target = this.buildTarget({ id: recipient.id, name: recipient.name, phone: recipient.whatsappPhone, message });
      if (target) targets.push(target);
    }

    return { kind: 'order_rejected', targets };
  }
}

module.exports = new WhatsAppFallbackService();
