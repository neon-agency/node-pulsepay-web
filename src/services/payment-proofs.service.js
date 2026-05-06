const AppError = require('../errors/app-error');
const fs = require('fs/promises');
const path = require('path');
const { createId } = require('../utils/id');
const rechargeRequestsRepository = require('../repositories/recharge-requests.repository');
const paymentProofsRepository = require('../repositories/recharge-request-payment-proofs.repository');
const paymentProofAnalysisService = require('./payment-proof-analysis.service');
const paymentProofNotificationsService = require('./payment-proof-notifications.service');
const salesNotificationsService = require('./sales-notifications.service');
const rechargeRequestsService = require('./recharge-requests.service');
const integrationsService = require('./bot-integrations.service');
const usersRepository = require('../repositories/users.repository');
const http = require('http');
const https = require('https');
const gcsService = require('./gcs.service');

class PaymentProofsService {
  buildInlineMediaRef(proofId) {
    return `inline:${proofId}`;
  }

  isInlineMediaRef(value) {
    return String(value || '').startsWith('inline:');
  }

  isLocalMediaRef(value) {
    return String(value || '').startsWith('local:');
  }

  getLocalPathFromMediaRef(value) {
    const relativePath = String(value || '').replace(/^local:/, '').trim();
    return path.resolve(process.cwd(), relativePath);
  }

  async tryWriteLocalProofFile({ proofId, fileName, fileBuffer }) {
    // Armazenamento em disco desabilitado por requisito.
    // Mantemos o comprovante apenas no banco (file_content_base64) ou em media externa (Meta).
    void proofId;
    void fileName;
    void fileBuffer;
    return null;
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

  buildGcsObjectName({ rechargeId, proofId, fileName, mimeType }) {
    const safeRechargeId = String(rechargeId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    const safeProofId = String(proofId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);

    const extFromName = path.extname(String(fileName || '')).slice(0, 12);
    const extFromMime = String(mimeType || '').includes('pdf') ? '.pdf' : '';
    const ext = extFromName || extFromMime || '.bin';

    return `payment-proofs/${safeRechargeId}/${safeProofId}${ext}`;
  }

  getZapServiceUrl() {
    return process.env.GO_ZAP_SERVICE_URL || 'http://localhost:8080';
  }

  async zapRequest(url, { method = 'GET', payload } = {}) {
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

  async sendZapText(number, message) {
    if (!number) return;
    await this.zapRequest(`${this.getZapServiceUrl()}/api/send`, {
      method: 'POST',
      payload: { number, message }
    });
  }

  async resolveOutcomeRecipients(recharge) {
    const recipients = new Set();
    if (recharge?.requestedByPhone) {
      recipients.add(String(recharge.requestedByPhone).trim());
    }
    if (recharge?.createdByUserId) {
      try {
        const user = await usersRepository.findById(recharge.createdByUserId);
        if (user?.whatsappPhone) {
          recipients.add(String(user.whatsappPhone).trim());
        }
      } catch (error) {
        console.error('Falha ao buscar usuario solicitante para notificacao:', error);
      }
    }
    return Array.from(recipients).filter(Boolean);
  }

  async notifyCustomerOutcome(recharge, decision) {
    const normalizedDecision = String(decision || '').trim().toLowerCase();
    if (normalizedDecision === 'approved') {
      return;
    }

    const recipients = await this.resolveOutcomeRecipients(recharge);
    if (recipients.length === 0) {
      return;
    }

    const message = [
      'Nao conseguimos aprovar o comprovante enviado. ❌',
      '',
      `Recarga: ${recharge.id}`,
      'Revise o pagamento e envie um novo comprovante para continuarmos a analise.'
    ].join('\n');

    for (const number of recipients) {
      try {
        await this.sendZapText(number, message);
      } catch (error) {
        console.error(`Falha ao notificar ${number} via GO-zap; tentando fallback Meta:`, error);
        try {
          await integrationsService.sendWhatsAppText(number, message);
        } catch (fallbackError) {
          console.error(`Fallback Meta tambem falhou para ${number}:`, fallbackError);
        }
      }
    }
  }

  async attachLatestProof(recharge) {
    const proof = await paymentProofsRepository.findLatestByRechargeRequestId(recharge.id);
    return {
      ...recharge,
      latestPaymentProof: proof
    };
  }

  async createFromBotMessage({ rechargeRequestId, senderPhone, messageId, media }) {
    const recharge = await rechargeRequestsRepository.findById(rechargeRequestId);
    if (!recharge) {
      throw new AppError('Solicitacao de recarga nao encontrada', 404);
    }

    if (!media?.id) {
      throw new AppError('Comprovante sem midia valida', 400);
    }

    const proof = await paymentProofsRepository.create({
      id: createId('proof'),
      rechargeRequestId,
      senderPhone,
      metaMessageId: messageId || null,
      metaMediaId: media.id,
      mimeType: media.mimeType || null,
      fileName: media.fileName || null,
      caption: media.caption || null,
      reviewStatus: 'pending_review'
    });

    let analysis;
    let downloadedBuffer = null;
    try {
      const download = await integrationsService.downloadWhatsAppMedia(media.id);
      downloadedBuffer = download.buffer || null;
      analysis = await paymentProofAnalysisService.analyze({
        mimeType: download.mimeType || media.mimeType || 'image/jpeg',
        fileBuffer: download.buffer,
        expectedAmount: recharge.totalAmount,
        pixIdentifier: recharge.pixTxid || process.env.PIX_KEY || null,
        rechargeId: recharge.id
      });
    } catch (error) {
      console.error('Falha ao baixar/analisar comprovante; seguindo com revisao manual:', error);
      analysis = {
        ...paymentProofAnalysisService.buildFallback(recharge.totalAmount),
        summary: 'Comprovante recebido e salvo. A analise automatica falhou, entao a revisao humana e obrigatoria.',
        raw: {
          reason: 'download_or_analysis_failed',
          message: error instanceof Error ? error.message : 'Falha desconhecida'
        }
      };
    }

    if (downloadedBuffer) {
      const persisted = await paymentProofsRepository.updateFileContent(
        proof.id,
        downloadedBuffer.toString('base64')
      );
      if (persisted) {
        proof.fileContentBase64 = persisted.fileContentBase64;
      }
    }

    let updatedProof = proof;
    try {
      updatedProof = await paymentProofsRepository.updateAnalysis(proof.id, {
        reviewStatus: 'pending_review',
        analysisProvider: analysis.provider,
        analysisSummary: analysis.summary,
        analysisConfidence: analysis.confidence,
        extractedAmount: analysis.extractedAmount,
        matchesExpectedAmount: analysis.matchesExpectedAmount,
        matchesPixIdentifier: analysis.matchesPixIdentifier,
        rawAnalysisJson: JSON.stringify(analysis.raw || {})
      });
    } catch (error) {
      console.error('Falha ao salvar analise do comprovante; mantendo revisao manual:', error);
    }

    try {
      await paymentProofNotificationsService.notifyPendingReview({
        recharge,
        proof: updatedProof
      });
    } catch (error) {
      console.error('Falha ao notificar revisao de comprovante:', error);
    }

    return {
      recharge,
      proof: updatedProof
    };
  }

  async createFromWebUpload({ rechargeRequestId, user, fileName, mimeType, contentBase64, comment }) {
    const recharge = await rechargeRequestsRepository.findById(rechargeRequestId);
    if (!recharge) {
      throw new AppError('Solicitacao de recarga nao encontrada', 404);
    }

    if (!contentBase64) {
      throw new AppError('Arquivo do comprovante nao informado', 400);
    }

    const normalizedMimeType = String(mimeType || 'application/octet-stream').trim().toLowerCase();
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMimeTypes.includes(normalizedMimeType)) {
      throw new AppError('Formato invalido. Envie JPG, PNG, WEBP ou PDF.', 400);
    }

    const fileBuffer = Buffer.from(String(contentBase64), 'base64');
    if (!fileBuffer.length) {
      throw new AppError('Arquivo do comprovante invalido', 400);
    }

    const maxBytes = 5 * 1024 * 1024;
    if (fileBuffer.length > maxBytes) {
      throw new AppError('Arquivo muito grande. Limite de 5 MB.', 400);
    }

    const proofId = createId('proof');
    const contentBase64Clean = fileBuffer.toString('base64');

    const trimmedComment = String(comment || '').trim().slice(0, 500);
    const captionValue = trimmedComment || 'Comprovante enviado pelo portal web';

    let gcsLocation = null;
    if (gcsService.isEnabled()) {
      try {
        const objectName = this.buildGcsObjectName({
          rechargeId: recharge.id,
          proofId,
          fileName,
          mimeType: normalizedMimeType
        });
        gcsLocation = await gcsService.uploadBuffer({
          objectName,
          buffer: fileBuffer,
          contentType: normalizedMimeType
        });
      } catch (error) {
        console.error('Falha ao enviar comprovante para GCS; seguindo com base64 no banco:', error);
      }
    }

    const proof = await paymentProofsRepository.create({
      id: proofId,
      rechargeRequestId,
      senderPhone: user?.whatsappPhone || `web:${user?.id || 'unknown'}`,
      metaMessageId: null,
      metaMediaId: gcsLocation ? null : this.buildInlineMediaRef(proofId),
      mimeType: normalizedMimeType,
      fileName: fileName || `comprovante-${recharge.id}`,
      caption: captionValue,
      reviewStatus: 'pending_review',
      fileContentBase64: gcsLocation ? null : contentBase64Clean,
      fileStorageProvider: gcsLocation ? 'gcs' : 'db',
      fileGcsBucket: gcsLocation?.bucket || null,
      fileGcsObject: gcsLocation?.object || null
    });

    const analysis = await paymentProofAnalysisService.analyze({
      mimeType: normalizedMimeType,
      fileBuffer,
      expectedAmount: recharge.totalAmount,
      pixIdentifier: recharge.pixTxid || process.env.PIX_KEY || null,
      rechargeId: recharge.id
    });

    const updatedProof = await paymentProofsRepository.updateAnalysis(proof.id, {
      reviewStatus: 'pending_review',
      analysisProvider: analysis.provider,
      analysisSummary: analysis.summary,
      analysisConfidence: analysis.confidence,
      extractedAmount: analysis.extractedAmount,
      matchesExpectedAmount: analysis.matchesExpectedAmount,
      matchesPixIdentifier: analysis.matchesPixIdentifier,
      rawAnalysisJson: JSON.stringify(analysis.raw || {})
    });

    try {
      await paymentProofNotificationsService.notifyPendingReview({
        recharge,
        proof: updatedProof
      });
    } catch (error) {
      console.error('Falha ao notificar revisao de comprovante web:', error);
    }

    try {
      await this.notifyProofReceived(recharge, user);
    } catch (error) {
      console.error('Falha ao confirmar recebimento ao revenda:', error);
    }

    return {
      recharge,
      proof: updatedProof
    };
  }

  async notifyProofReceived(recharge, user) {
    const recipients = new Set();
    if (user?.whatsappPhone) recipients.add(String(user.whatsappPhone).trim());
    if (recharge?.requestedByPhone) recipients.add(String(recharge.requestedByPhone).trim());
    const numbers = Array.from(recipients).filter(Boolean);
    if (numbers.length === 0) return;

    const message = [
      'Comprovante recebido com sucesso. ✅',
      '',
      `Recarga: ${recharge.id}`,
      'Você será notificado quando a recarga for efetuada.'
    ].join('\n');

    for (const number of numbers) {
      try {
        await this.sendZapText(number, message);
      } catch (error) {
        console.error(`Falha confirmar recebimento ${number}:`, error);
        try {
          await integrationsService.sendWhatsAppText(number, message);
        } catch (fallbackError) {
          console.error(`Fallback Meta falhou ${number}:`, fallbackError);
        }
      }
    }
  }

  async getLatestByRechargeRequestId(rechargeRequestId) {
    const recharge = await rechargeRequestsRepository.findById(rechargeRequestId);
    if (!recharge) {
      throw new AppError('Solicitacao de recarga nao encontrada', 404);
    }

    const proof = await paymentProofsRepository.findLatestByRechargeRequestId(rechargeRequestId);
    if (!proof) {
      throw new AppError('Nenhum comprovante encontrado para esta recarga', 404);
    }

    return {
      recharge,
      proof
    };
  }

  async reviewLatest({ rechargeRequestId, reviewedByUserId, decision, reviewerNotes }) {
    const { recharge, proof } = await this.getLatestByRechargeRequestId(rechargeRequestId);
    const normalizedDecision = String(decision || '').trim().toLowerCase();

    if (!['approved', 'rejected'].includes(normalizedDecision)) {
      throw new AppError('Decisao invalida. Use approved ou rejected.', 400);
    }

    const updatedProof = await paymentProofsRepository.markReviewed(proof.id, {
      reviewStatus: normalizedDecision,
      reviewedByUserId,
      reviewerNotes: reviewerNotes || null
    });

    if (normalizedDecision === 'approved' && recharge.paymentStatus !== 'pago') {
      await rechargeRequestsService.updatePayment(rechargeRequestId, {
        paymentStatus: 'pago'
      });
    }

    const updatedRecharge = await rechargeRequestsRepository.findById(rechargeRequestId);
    await this.notifyCustomerOutcome(updatedRecharge, normalizedDecision);

    if (normalizedDecision === 'approved') {
      try {
        await salesNotificationsService.processPaidRecharge(updatedRecharge);
      } catch (error) {
        console.error('Falha ao notificar conclusao da recarga:', error);
      }
    }

    return {
      recharge: updatedRecharge,
      proof: updatedProof
    };
  }

  async downloadProofFile(rechargeRequestId) {
    const { proof } = await this.getLatestByRechargeRequestId(rechargeRequestId);
    if (!proof.metaMediaId && !proof.fileContentBase64 && !(proof.fileGcsBucket && proof.fileGcsObject)) {
      throw new AppError('Comprovante nao possui arquivo vinculado', 404);
    }

    if (proof.fileGcsBucket && proof.fileGcsObject) {
      try {
        const buffer = await gcsService.downloadBuffer({
          bucketName: proof.fileGcsBucket,
          objectName: proof.fileGcsObject
        });
        return {
          mimeType: proof.mimeType || 'application/octet-stream',
          buffer
        };
      } catch (error) {
        throw new AppError('Arquivo do comprovante indisponivel', 404);
      }
    }

    if (proof.fileContentBase64) {
      return {
        mimeType: proof.mimeType || 'application/octet-stream',
        buffer: Buffer.from(proof.fileContentBase64, 'base64')
      };
    }

    if (this.isInlineMediaRef(proof.metaMediaId)) {
      throw new AppError('Arquivo do comprovante indisponivel', 404);
    }

    if (this.isGcsMediaRef(proof.metaMediaId)) {
      const parsed = this.parseGcsMediaRef(proof.metaMediaId);
      if (!parsed) {
        throw new AppError('Arquivo do comprovante indisponivel', 404);
      }
      try {
        const buffer = await gcsService.downloadBuffer({
          bucketName: parsed.bucket,
          objectName: parsed.object
        });
        return {
          mimeType: proof.mimeType || 'application/octet-stream',
          buffer
        };
      } catch (_error) {
        throw new AppError('Arquivo do comprovante indisponivel', 404);
      }
    }

    if (this.isLocalMediaRef(proof.metaMediaId)) {
      try {
        const absolutePath = this.getLocalPathFromMediaRef(proof.metaMediaId);
        const buffer = await fs.readFile(absolutePath);
        return {
          mimeType: proof.mimeType || 'application/octet-stream',
          buffer
        };
      } catch (error) {
        throw new AppError('Arquivo do comprovante indisponivel', 404);
      }
    }

    return integrationsService.downloadWhatsAppMedia(proof.metaMediaId);
  }
}

module.exports = new PaymentProofsService();
