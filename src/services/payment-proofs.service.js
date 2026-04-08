const AppError = require('../errors/app-error');
const { createId } = require('../utils/id');
const rechargeRequestsRepository = require('../repositories/recharge-requests.repository');
const paymentProofsRepository = require('../repositories/recharge-request-payment-proofs.repository');
const paymentProofAnalysisService = require('./payment-proof-analysis.service');
const paymentProofNotificationsService = require('./payment-proof-notifications.service');
const rechargeRequestsService = require('./recharge-requests.service');
const integrationsService = require('./bot-integrations.service');

class PaymentProofsService {
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
      console.error('Falha ao notificar revisao de comprovante:', error);
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

    return {
      recharge: await rechargeRequestsRepository.findById(rechargeRequestId),
      proof: updatedProof
    };
  }

  async downloadProofFile(rechargeRequestId) {
    const { proof } = await this.getLatestByRechargeRequestId(rechargeRequestId);
    if (!proof.metaMediaId) {
      throw new AppError('Comprovante nao possui arquivo vinculado', 404);
    }

    return integrationsService.downloadWhatsAppMedia(proof.metaMediaId);
  }
}

module.exports = new PaymentProofsService();
