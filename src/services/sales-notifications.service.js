const http = require('http');
const https = require('https');
const rechargeRequestsRepository = require('../repositories/recharge-requests.repository');
const notificationsRepository = require('../repositories/recharge-request-notifications.repository');
const usersRepository = require('../repositories/users.repository');
const { createId } = require('../utils/id');

class SalesNotificationsService {
  constructor() {
    this.interval = null;
    this.isProcessing = false;
    this.eventType = 'sale_paid';
  }

  getZapServiceUrl() {
    return process.env.GO_ZAP_SERVICE_URL || 'http://localhost:8080';
  }

  getPollIntervalMs() {
    const value = Number(process.env.SALES_NOTIFICATIONS_POLL_INTERVAL_MS || 30000);
    return Number.isFinite(value) && value >= 5000 ? value : 30000;
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
      if (body) {
        req.write(body);
      }
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

  buildMessage(recharge, recipient) {
    const createdAt = recharge.updatedAt || recharge.createdAt;
    const formattedDate = new Date(createdAt).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo'
    });

    return [
      `Venda confirmada`,
      ``,
      `Usuario: ${recipient.name}`,
      `Valor: ${Number(recharge.totalAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      `Servidor: ${recharge.servidor || '-'}`,
      `Conta/Login: ${recharge.accountLogin}`,
      `Identificador: ${recharge.id}`,
      `Data/Hora: ${formattedDate}`,
      `Status: Pago`
    ].join('\n');
  }

  async sendMessage(number, message) {
    await this.makeRequest(`${this.getZapServiceUrl()}/api/send`, {
      method: 'POST',
      payload: {
        number,
        message
      }
    });
  }

  async ensureNotificationRow(rechargeRequestId, recipientUserId) {
    const existing = await notificationsRepository.findByRechargeRequestAndRecipient(
      rechargeRequestId,
      recipientUserId,
      this.eventType
    );
    if (existing) {
      return existing;
    }

    return notificationsRepository.create({
      id: createId('ntf'),
      rechargeRequestId,
      recipientUserId,
      eventType: this.eventType,
      deliveryStatus: 'pending'
    });
  }

  async processPaidRecharge(recharge) {
    const recipients = recharge.createdByUserId
      ? [await usersRepository.findById(recharge.createdByUserId)].filter((user) => (
          user &&
          user.isActive &&
          user.whatsappPhone
        ))
      : await usersRepository.findAllActiveWithWhatsapp();

    if (recipients.length === 0) {
      return;
    }

    const isConnected = await this.isZapConnected();
    if (!isConnected) {
      for (const recipient of recipients) {
        const notification = await this.ensureNotificationRow(recharge.id, recipient.id);
        if (notification.deliveryStatus !== 'sent') {
          await notificationsRepository.markFailed(notification.id, 'GO-zap-service offline ou desconectado');
        }
      }
      return;
    }

    for (const recipient of recipients) {
      const notification = await this.ensureNotificationRow(recharge.id, recipient.id);
      if (notification.deliveryStatus === 'sent') {
        continue;
      }

      try {
        await this.sendMessage(recipient.whatsappPhone, this.buildMessage(recharge, recipient));
        await notificationsRepository.markSent(notification.id);
      } catch (error) {
        await notificationsRepository.markFailed(
          notification.id,
          error instanceof Error ? error.message : 'Falha ao enviar WhatsApp'
        );
      }
    }
  }

  async processPendingSales() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      const paidRequests = await rechargeRequestsRepository.findPaid();
      for (const recharge of paidRequests) {
        await this.processPaidRecharge(recharge);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  startWorker() {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      void this.processPendingSales();
    }, this.getPollIntervalMs());

    void this.processPendingSales();
  }
}

module.exports = new SalesNotificationsService();
