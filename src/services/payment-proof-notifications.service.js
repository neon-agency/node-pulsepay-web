const http = require('http');
const https = require('https');
const fs = require('fs/promises');
const path = require('path');
const integrationsService = require('./bot-integrations.service');
const gcsService = require('./gcs.service');
const usersRepository = require('../repositories/users.repository');
const notificationsRepository = require('../repositories/recharge-request-notifications.repository');
const { createId } = require('../utils/id');

class PaymentProofNotificationsService {
  isLocalMediaRef(value) {
    return String(value || '').startsWith('local:');
  }

  isInlineMediaRef(value) {
    return String(value || '').startsWith('inline:');
  }

  isGcsMediaRef(value) {
    return String(value || '').startsWith('gcs:');
  }

  parseGcsMediaRef(value) {
    const ref = String(value || '').replace(/^gcs:/, '').trim();
    const [bucket, ...rest] = ref.split('/');
    const object = rest.join('/');
    if (!bucket || !object) return null;
    return { bucket, object };
  }

  getLocalPathFromMediaRef(value) {
    const relativePath = String(value || '').replace(/^local:/, '').trim();
    return path.resolve(process.cwd(), relativePath);
  }

  getEventType(proofId) {
    return `proof_review:${proofId}`;
  }

  getZapServiceUrl() {
    return process.env.GO_ZAP_SERVICE_URL || 'http://localhost:8080';
  }

  getAdminUrl() {
    return process.env.PULSEPAY_ADMIN_URL || process.env.INTERNAL_API_BASE_URL || 'https://nano-gerenciador.vercel.app';
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

  buildMessage({ recharge, proof }) {
    const revenda = recharge.createdByUserName || recharge.credentialNome || '-';
    const servidorNome = recharge.servidor || '-';
    const servidor = recharge.servidorUrl
      ? `${servidorNome} - ${recharge.servidorUrl}`
      : servidorNome;
    const dataHora = new Date(recharge.updatedAt || recharge.createdAt || Date.now())
      .toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const valor = Number(recharge.totalAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const lines = [
      '*RECARGA SOLICITADA*',
      '',
      `Revendedor: ${revenda}`,
      `Telefone: ${proof.senderPhone}`,
      '',
      `Servidor: ${servidor}`,
      `Login: ${recharge.accountLogin}`,
      `Quantidade: ${recharge.quantity}`,
      `Valor: ${valor}`
    ];

    if (proof.caption) {
      lines.push('', '*Comentário:*', String(proof.caption));
    }

    lines.push('', 'Painel Recarga:', this.getAdminUrl(), '', dataHora, '*RECARGA FÁCIL*');

    return lines.join('\n');
  }

  async sendText(number, message) {
    await this.makeRequest(`${this.getZapServiceUrl()}/api/send`, {
      method: 'POST',
      payload: {
        number,
        message
      }
    });
  }

  async sendMedia(number, mediaPayload) {
    await this.makeRequest(`${this.getZapServiceUrl()}/api/send-media`, {
      method: 'POST',
      payload: {
        number,
        caption: mediaPayload.caption,
        mimeType: mediaPayload.mimeType,
        fileName: mediaPayload.fileName,
        dataBase64: mediaPayload.dataBase64,
        mediaType: mediaPayload.mediaType
      }
    });
  }

  async ensureNotificationRow(rechargeRequestId, recipientUserId, proofId) {
    const existing = await notificationsRepository.findByRechargeRequestAndRecipient(
      rechargeRequestId,
      recipientUserId,
      this.getEventType(proofId)
    );
    if (existing) {
      return existing;
    }

    return notificationsRepository.create({
      id: createId('ntf'),
      rechargeRequestId,
      recipientUserId,
      eventType: this.getEventType(proofId),
      deliveryStatus: 'pending'
    });
  }

  async notifyPendingReview({ recharge, proof }) {
    const recipients = await usersRepository.findAllAdminsWithWhatsapp();
    if (recipients.length === 0) {
      return;
    }

    const connected = await this.isZapConnected();
    let mediaPayload = null;
    if (proof.metaMediaId || proof.fileContentBase64 || (proof.fileGcsBucket && proof.fileGcsObject)) {
      try {
        let file;
        if (proof.fileContentBase64) {
          file = {
            mimeType: proof.mimeType || 'application/octet-stream',
            buffer: Buffer.from(proof.fileContentBase64, 'base64')
          };
        } else if (proof.fileGcsBucket && proof.fileGcsObject) {
          file = {
            mimeType: proof.mimeType || 'application/octet-stream',
            buffer: await gcsService.downloadBuffer({
              bucketName: proof.fileGcsBucket,
              objectName: proof.fileGcsObject
            })
          };
        } else if (this.isInlineMediaRef(proof.metaMediaId)) {
          throw new Error('Comprovante inline sem conteudo no banco');
        } else if (this.isGcsMediaRef(proof.metaMediaId)) {
          const parsed = this.parseGcsMediaRef(proof.metaMediaId);
          if (!parsed) throw new Error('Comprovante GCS invalido');
          file = {
            mimeType: proof.mimeType || 'application/octet-stream',
            buffer: await gcsService.downloadBuffer({
              bucketName: parsed.bucket,
              objectName: parsed.object
            })
          };
        } else if (this.isLocalMediaRef(proof.metaMediaId)) {
          file = {
            mimeType: proof.mimeType || 'application/octet-stream',
            buffer: await fs.readFile(this.getLocalPathFromMediaRef(proof.metaMediaId))
          };
        } else {
          file = await integrationsService.downloadWhatsAppMedia(proof.metaMediaId);
        }
        const mimeType = file.mimeType || proof.mimeType || 'image/jpeg';
        mediaPayload = {
          caption: `Comprovante da recarga ${recharge.id}`,
          mimeType,
          fileName: proof.fileName || `comprovante-${recharge.id}`,
          dataBase64: file.buffer.toString('base64'),
          mediaType: String(mimeType).startsWith('image/') ? 'image' : 'document'
        };
      } catch (error) {
        console.error('Falha ao baixar comprovante para envio ao GO-zap-service:', error);
      }
    }

    for (const recipient of recipients) {
      const notification = await this.ensureNotificationRow(recharge.id, recipient.id, proof.id);
      if (notification.deliveryStatus === 'sent') {
        continue;
      }

      if (!connected) {
        await notificationsRepository.markFailed(notification.id, 'GO-zap-service offline ou desconectado');
        continue;
      }

      try {
        await this.sendText(recipient.whatsappPhone, this.buildMessage({ recharge, proof }));
        if (mediaPayload) {
          await this.sendMedia(recipient.whatsappPhone, mediaPayload);
        }
        await notificationsRepository.markSent(notification.id);
      } catch (error) {
        await notificationsRepository.markFailed(
          notification.id,
          error instanceof Error ? error.message : 'Falha ao notificar revisor'
        );
      }
    }
  }
}

module.exports = new PaymentProofNotificationsService();
