const AppError = require('../errors/app-error');
const fs = require('fs/promises');
const path = require('path');
const { createId } = require('../utils/id');
const rechargeRequestsRepository = require('../repositories/recharge-requests.repository');
const paymentProofsRepository = require('../repositories/recharge-request-payment-proofs.repository');
const paymentProofAnalysisService = require('./payment-proof-analysis.service');
const paymentProofNotificationsService = require('./payment-proof-notifications.service');
const rechargeRequestsService = require('./recharge-requests.service');
const integrationsService = require('./bot-integrations.service');

class PaymentProofsService {
  getStorageDir() {
    return path.resolve(process.cwd(), 'storage', 'payment-proofs');
  }

  buildLocalMediaRef(relativePath) {
    return `local:${relativePath}`;
  }

  isLocalMediaRef(value) {
    return String(value || '').startsWith('local:');
  }

  getLocalPathFromMediaRef(value) {
    const relativePath = String(value || '').replace(/^local:/, '').trim();
    return path.resolve(process.cwd(), relativePath);
  }

  async saveLocalProofFile({ proofId, fileName, fileBuffer }) {
    const ext = path.extname(String(fileName || '')).slice(0, 12) || '.bin';
    const relativePath = path.join('storage', 'payment-proofs', `${proofId}${ext}`);
    const absolutePath = path.resolve(process.cwd(), relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, fileBuffer);
    return relativePath;
  }

  async notifyCustomerOutcome(recharge, decision) {
    if (!recharge?.requestedByPhone) {
      return;
    }

    const normalizedDecision = String(decision || '').trim().toLowerCase();
    const message = normalizedDecision === 'approved'
      ? [
          'Pagamento aprovado com sucesso. ✅',
          '',
          `Sua recarga ${recharge.id} foi validada e concluida.`,
          `Servidor: ${recharge.servidor || '-'}`,
          `Conta/Login: ${recharge.accountLogin || '-'}`,
          `Quantidade: ${recharge.quantity}`,
          '',
          'Obrigado! Se precisar de algo, e so chamar.'
        ].join('\n')
      : [
          'Nao conseguimos aprovar o comprovante enviado. ❌',
          '',
          `Recarga: ${recharge.id}`,
          'Revise o pagamento e envie um novo comprovante para continuarmos a analise.'
        ].join('\n');

    try {
      await integrationsService.sendWhatsAppText(recharge.requestedByPhone, message);
    } catch (error) {
      console.error('Falha ao notificar cliente sobre resultado da validacao:', error);
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
    try {
      const download = await integrationsService.downloadWhatsAppMedia(media.id);
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

  async createFromWebUpload({ rechargeRequestId, user, fileName, mimeType, contentBase64 }) {
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
    const relativePath = await this.saveLocalProofFile({
      proofId,
      fileName,
      fileBuffer
    });

    const proof = await paymentProofsRepository.create({
      id: proofId,
      rechargeRequestId,
      senderPhone: user?.whatsappPhone || `web:${user?.id || 'unknown'}`,
      metaMessageId: null,
      metaMediaId: this.buildLocalMediaRef(relativePath),
      mimeType: normalizedMimeType,
      fileName: fileName || `comprovante-${recharge.id}`,
      caption: 'Comprovante enviado pelo portal web',
      reviewStatus: 'pending_review'
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

    return {
      recharge,
      proof: updatedProof
    };
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

    return {
      recharge: updatedRecharge,
      proof: updatedProof
    };
  }

  async downloadProofFile(rechargeRequestId) {
    const { proof } = await this.getLatestByRechargeRequestId(rechargeRequestId);
    if (!proof.metaMediaId) {
      throw new AppError('Comprovante nao possui arquivo vinculado', 404);
    }

    if (this.isLocalMediaRef(proof.metaMediaId)) {
      const absolutePath = this.getLocalPathFromMediaRef(proof.metaMediaId);
      const buffer = await fs.readFile(absolutePath);
      return {
        mimeType: proof.mimeType || 'application/octet-stream',
        buffer
      };
    }

    return integrationsService.downloadWhatsAppMedia(proof.metaMediaId);
  }
}

module.exports = new PaymentProofsService();
