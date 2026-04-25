const http = require('http');
const https = require('https');
const usersRepository = require('../repositories/users.repository');
const notificationsRepository = require('../repositories/recharge-request-notifications.repository');
const { createId } = require('../utils/id');

class RechargeCancellationNotificationsService {
  constructor() {
    this.eventType = 'recharge_cancelled';
  }

  getZapServiceUrl() {
    return process.env.GO_ZAP_SERVICE_URL || 'http://localhost:8080';
  }

  async makeRequest(url, { method = 'GET', payload } = {}) {
    const protocol = url.startsWith('https') ? https : http;
    const body = payload ? JSON.stringify(payload) : null;

    return new Promise((resolve, reject) => {
      const req = protocol.request(url, {
        method,
        headers: body
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body)
            }
          : undefined
      }, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            return reject(new Error(`Status ${res.statusCode}: ${responseBody}`));
          }
          resolve(responseBody);
        });
      });

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  async isZapConnected() {
    try {
      const raw = await this.makeRequest(`${this.getZapServiceUrl()}/api/status`);
      const payload = JSON.parse(raw);
      return payload?.connected === true;
    } catch (_error) {
      return false;
    }
  }

  buildMessage({ recharge, cancelledBy }) {
    const dataHora = new Date(recharge.updatedAt || Date.now()).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo'
    });
    const valor = Number(recharge.totalAmount).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

    return [
      'Solicitação cancelada',
      '',
      `Revenda: ${recharge.createdByUserName || recharge.credentialNome || '-'}`,
      `Cancelado por: ${cancelledBy?.name || cancelledBy?.email || '-'}`,
      `Servidor: ${recharge.servidor || '-'}`,
      `Login: ${recharge.accountLogin || '-'}`,
      `Quantidade: ${recharge.quantity}`,
      `Valor: ${valor}`,
      '',
      `Data/Hora: ${dataHora}`,
      `Identificador: ${recharge.id}`
    ].join('\n');
  }

  async sendText(number, message) {
    await this.makeRequest(`${this.getZapServiceUrl()}/api/send`, {
      method: 'POST',
      payload: { number, message }
    });
  }

  async ensureNotificationRow(rechargeRequestId, recipientUserId) {
    const existing = await notificationsRepository.findByRechargeRequestAndRecipient(
      rechargeRequestId,
      recipientUserId,
      this.eventType
    );
    if (existing) return existing;

    return notificationsRepository.create({
      id: createId('ntf'),
      rechargeRequestId,
      recipientUserId,
      eventType: this.eventType,
      deliveryStatus: 'pending'
    });
  }

  async notifyCancelled({ recharge, cancelledBy }) {
    const recipientMap = new Map();
    const addRecipient = (user) => {
      if (!user?.id || !user?.whatsappPhone) return;
      recipientMap.set(user.id, user);
    };

    const admins = await usersRepository.findAllAdminsWithWhatsapp();
    admins.forEach(addRecipient);
    addRecipient(cancelledBy);

    const recipients = Array.from(recipientMap.values());
    if (recipients.length === 0) return;

    const connected = await this.isZapConnected();
    for (const recipient of recipients) {
      const notification = await this.ensureNotificationRow(recharge.id, recipient.id);
      if (notification.deliveryStatus === 'sent') continue;

      if (!connected) {
        await notificationsRepository.markFailed(notification.id, 'GO-zap-service offline ou desconectado');
        continue;
      }

      try {
        await this.sendText(recipient.whatsappPhone, this.buildMessage({ recharge, cancelledBy }));
        await notificationsRepository.markSent(notification.id);
      } catch (error) {
        await notificationsRepository.markFailed(
          notification.id,
          error instanceof Error ? error.message : 'Falha ao notificar cancelamento'
        );
      }
    }
  }
}

module.exports = new RechargeCancellationNotificationsService();
