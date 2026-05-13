const http = require('http');
const https = require('https');
const rechargeRequestsRepository = require('../repositories/recharge-requests.repository');
const notificationsRepository = require('../repositories/recharge-request-notifications.repository');
const usersRepository = require('../repositories/users.repository');
const credentialsRepository = require('../repositories/credentials.repository');
const whiteLabelRepository = require('../repositories/white-label.repository');
const { createId } = require('../utils/id');

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

  buildMessage(recharge, recipient, brandName) {
    const createdAt = recharge.updatedAt || recharge.createdAt;
    const formattedDate = new Date(createdAt).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo'
    });

    const valor = Number(recharge.totalAmount).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

    const brand = (brandName || DEFAULT_BRAND_NAME).toUpperCase();

    return [
      `Recarga concluída com sucesso ✅`,
      ``,
      `Olá ${recipient.name},`,
      `Sua recarga foi efetivada.`,
      ``,
      `Servidor: ${recharge.servidor || '-'}`,
      `Login: ${recharge.accountLogin}`,
      `Quantidade: ${recharge.quantity}`,
      `Valor: ${valor}`,
      ``,
      `Data/Hora: ${formattedDate}`,
      `Identificador: ${recharge.id}`,
      ``,
      `EQUIPE ${brand} AGRADECE!`
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

  async resolveRecipients(recharge) {
    const byId = new Map();
    const addUser = (user) => {
      if (!user || !user.isActive || !user.whatsappPhone) return;
      if (user.role === 'admin') return;
      byId.set(user.id, user);
    };

    if (recharge.createdByUserId) {
      addUser(await usersRepository.findById(recharge.createdByUserId));
    }

    if (recharge.credentialId) {
      try {
        const credential = await credentialsRepository.findById(recharge.credentialId);
        if (credential?.clientId) {
          const resellerUsers = await usersRepository.findActiveByClientIdWithWhatsapp(credential.clientId);
          resellerUsers.forEach(addUser);
        }
      } catch (error) {
        console.error('Falha ao buscar usuários da credencial para notificação:', error);
      }
    }

    return Array.from(byId.values());
  }

  async processPaidRecharge(recharge) {
    const recipients = await this.resolveRecipients(recharge);

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
        const brandName = await resolveBrandName(recipient.adminId);
        await this.sendMessage(recipient.whatsappPhone, this.buildMessage(recharge, recipient, brandName));
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
