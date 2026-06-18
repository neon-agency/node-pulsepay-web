const webpush = require('web-push');
const { createId } = require('../utils/id');
const AppError = require('../errors/app-error');
const pushSubscriptionsRepository = require('../repositories/push-subscriptions.repository');
const usersRepository = require('../repositories/users.repository');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@pulsepay.com';

const enabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (enabled) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn('[push] VAPID keys ausentes — push desabilitado (defina VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY).');
}

function formatBRL(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const STATUS_LABEL = {
  SOLICITADO: 'Solicitado',
  EM_ESPERA: 'Em espera',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado'
};

class PushService {
  isEnabled() {
    return enabled;
  }

  getPublicKey() {
    return VAPID_PUBLIC_KEY || null;
  }

  async saveSubscription(userId, subscription, userAgent) {
    if (!userId) throw new AppError('Usuário não autenticado', 401);
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      throw new AppError('Subscription inválida', 400);
    }
    return pushSubscriptionsRepository.upsert({
      id: createId(),
      userId,
      endpoint,
      p256dh,
      auth,
      userAgent: userAgent ? String(userAgent).slice(0, 255) : null
    });
  }

  async removeSubscription(endpoint) {
    if (!endpoint) return 0;
    return pushSubscriptionsRepository.deleteByEndpoint(endpoint);
  }

  // Envia para todas as subscriptions de uma lista de usuários. Remove as que
  // o navegador reporta como expiradas (404/410).
  async _sendToSubscriptions(subscriptions, payload) {
    if (!enabled || subscriptions.length === 0) return;
    const body = JSON.stringify(payload);
    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        };
        try {
          await webpush.sendNotification(pushSub, body);
        } catch (error) {
          const status = error?.statusCode;
          if (status === 404 || status === 410) {
            await pushSubscriptionsRepository.deleteByEndpoint(sub.endpoint).catch(() => {});
          } else {
            console.error('[push] falha ao enviar:', status, error?.body || error?.message);
          }
        }
      })
    );
  }

  async sendToUser(userId, payload) {
    if (!enabled || !userId) return;
    const subs = await pushSubscriptionsRepository.findByUserId(userId);
    await this._sendToSubscriptions(subs, payload);
  }

  async sendToUsers(userIds, payload) {
    if (!enabled) return;
    const unique = [...new Set((userIds || []).filter(Boolean))];
    if (unique.length === 0) return;
    const subs = await pushSubscriptionsRepository.findByUserIds(unique);
    await this._sendToSubscriptions(subs, payload);
  }

  // Admin(s) que devem ser avisados de um pedido criado por uma revenda.
  // Se a revenda tem admin dono (admin_id), notifica só ele; senão, todos os
  // admins ativos (fallback p/ pedidos sem dono explícito).
  async _resolveAdminRecipients(creatorUserId) {
    if (creatorUserId) {
      const creator = await usersRepository.findById(creatorUserId);
      if (creator?.adminId) return [creator.adminId];
    }
    const all = await usersRepository.findAll();
    return all.filter((u) => u.role === 'admin' && u.isActive).map((u) => u.id);
  }

  // Hook: comprovante anexado → pedido virou solicitação real → avisa admin.
  async notifyNewOrder(order) {
    if (!enabled || !order) return;
    try {
      const adminIds = await this._resolveAdminRecipients(order.createdByUserId);
      const itemCount = order.itemCount ?? 0;
      await this.sendToUsers(adminIds, {
        title: 'Nova solicitação de recarga',
        body: `${itemCount} item${itemCount === 1 ? '' : 's'} · ${formatBRL(order.totalAmount)}`,
        tag: `order-new-${order.id}`,
        url: '/orders'
      });
    } catch (error) {
      console.error('[push] notifyNewOrder:', error);
    }
  }

  // Hook: status do pedido mudou → avisa a revenda que criou o pedido.
  async notifyStatusChange(order, status) {
    if (!enabled || !order?.createdByUserId) return;
    try {
      const label = STATUS_LABEL[status] || status;
      await this.sendToUser(order.createdByUserId, {
        title: `Pedido ${label.toLowerCase()}`,
        body: `Seu pedido de ${formatBRL(order.totalAmount)} está ${label.toLowerCase()}.`,
        tag: `order-status-${order.id}`,
        url: '/reseller'
      });
    } catch (error) {
      console.error('[push] notifyStatusChange:', error);
    }
  }
}

module.exports = new PushService();
