const AppError = require('../errors/app-error');
const fs = require('fs/promises');
const path = require('path');
const { createId } = require('../utils/id');
const rechargeRequestsRepository = require('../repositories/recharge-requests.repository');
const paymentProofsRepository = require('../repositories/recharge-request-payment-proofs.repository');
const paymentProofAnalysisService = require('./payment-proof-analysis.service');
const rechargeRequestsService = require('./recharge-requests.service');

class PaymentProofsService {
  getStorageDir() {
    return path.resolve(process.cwd(), 'storage', 'payment-proofs');
  }

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
    try {
      const ext = path.extname(String(fileName || '')).slice(0, 12) || '.bin';
      const relativePath = path.join('storage', 'payment-proofs', `${proofId}${ext}`);
      const absolutePath = path.resolve(process.cwd(), relativePath);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, fileBuffer);
      return relativePath;
    } catch (error) {
      console.warn('Disco local indisponivel; comprovante sera mantido somente no banco:', error?.message || error);
      return null;
    }
  }

  async attachLatestProof(recharge) {
    const proof = await paymentProofsRepository.findLatestByRechargeRequestId(recharge.id);
    return {
      ...recharge,
      latestPaymentProof: proof
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
    await this.tryWriteLocalProofFile({ proofId, fileName, fileBuffer });

    const trimmedComment = String(comment || '').trim().slice(0, 500);
    const captionValue = trimmedComment || 'Comprovante enviado pelo portal web';

    const proof = await paymentProofsRepository.create({
      id: proofId,
      rechargeRequestId,
      senderPhone: user?.whatsappPhone || `web:${user?.id || 'unknown'}`,
      metaMessageId: null,
      metaMediaId: this.buildInlineMediaRef(proofId),
      mimeType: normalizedMimeType,
      fileName: fileName || `comprovante-${recharge.id}`,
      caption: captionValue,
      reviewStatus: 'pending_review',
      fileContentBase64: contentBase64Clean
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

    if (!['approved', 'rejected', 'sem_creditos', 'comprovante_invalido'].includes(normalizedDecision)) {
      throw new AppError('Decisao invalida. Use approved, rejected, sem_creditos ou comprovante_invalido.', 400);
    }

    // Status "limbo" (sem_creditos / comprovante_invalido): marca a recarga mas
    // mantem o comprovante pendente (sem markReviewed) para continuar aprovavel.
    if (normalizedDecision === 'sem_creditos' || normalizedDecision === 'comprovante_invalido') {
      if (recharge.paymentStatus !== normalizedDecision) {
        await rechargeRequestsService.updatePayment(rechargeRequestId, {
          paymentStatus: normalizedDecision,
          paymentMethod: recharge.paymentMethod,
          pixCode: recharge.pixCode,
          pixTxid: recharge.pixTxid
        });
      }
      const updatedRecharge = await rechargeRequestsRepository.findById(rechargeRequestId);
      return {
        recharge: updatedRecharge,
        proof
      };
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

    if (normalizedDecision === 'rejected' && recharge.paymentStatus !== 'cancelado') {
      await rechargeRequestsService.updatePayment(rechargeRequestId, {
        paymentStatus: 'cancelado',
        paymentMethod: recharge.paymentMethod,
        pixCode: recharge.pixCode,
        pixTxid: recharge.pixTxid
      });
    }

    const updatedRecharge = await rechargeRequestsRepository.findById(rechargeRequestId);

    return {
      recharge: updatedRecharge,
      proof: updatedProof
    };
  }

  async createFromWebUploadForOrder({ rechargeOrderId, user, fileName, mimeType, contentBase64, comment }) {
    const rechargeOrdersRepository = require('../repositories/recharge-orders.repository');
    const order = await rechargeOrdersRepository.findById(rechargeOrderId);
    if (!order) {
      throw new AppError('Pedido nao encontrado', 404);
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
    await this.tryWriteLocalProofFile({ proofId, fileName, fileBuffer });

    const trimmedComment = String(comment || '').trim().slice(0, 500);
    const captionValue = trimmedComment || 'Comprovante enviado pelo portal web';

    const proof = await paymentProofsRepository.create({
      id: proofId,
      rechargeOrderId,
      senderPhone: user?.whatsappPhone || null,
      metaMessageId: null,
      metaMediaId: this.buildInlineMediaRef(proofId),
      mimeType: normalizedMimeType,
      fileName: fileName || `comprovante-${order.id}`,
      caption: captionValue,
      reviewStatus: 'pending_review',
      fileContentBase64: contentBase64Clean
    });

    let analysis;
    try {
      analysis = await paymentProofAnalysisService.analyze({
        mimeType: normalizedMimeType,
        fileBuffer,
        expectedAmount: order.totalAmount,
        pixIdentifier: order.pixTxid || order.pixCode || process.env.PIX_KEY || null,
        rechargeId: order.id
      });
    } catch (error) {
      console.error('Falha ao analisar comprovante de pedido:', error);
      analysis = paymentProofAnalysisService.buildFallback(order.totalAmount);
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
      console.error('Falha ao salvar analise do comprovante de pedido:', error);
    }

    return {
      order,
      proof: updatedProof
    };
  }

  async getLatestForOrder(rechargeOrderId) {
    const rechargeOrdersRepository = require('../repositories/recharge-orders.repository');
    const order = await rechargeOrdersRepository.findById(rechargeOrderId);
    if (!order) {
      throw new AppError('Pedido nao encontrado', 404);
    }

    const proof = await paymentProofsRepository.findLatestByOrderId(rechargeOrderId);
    if (!proof) {
      throw new AppError('Nenhum comprovante encontrado para este pedido', 404);
    }
    return { order, proof };
  }

  async reviewLatestForOrder({ rechargeOrderId, reviewedByUserId, decision, reviewerNotes }) {
    const rechargeOrdersService = require('./recharge-orders.service');
    const { proof } = await this.getLatestForOrder(rechargeOrderId);
    const normalizedDecision = String(decision || '').trim().toLowerCase();
    if (!['approved', 'rejected', 'sem_creditos', 'comprovante_invalido'].includes(normalizedDecision)) {
      throw new AppError('Decisao invalida. Use approved, rejected, sem_creditos ou comprovante_invalido.', 400);
    }

    // Status "limbo": marca o pedido sem revisar o comprovante (continua pending),
    // mantendo-o aprovavel depois.
    if (normalizedDecision === 'sem_creditos' || normalizedDecision === 'comprovante_invalido') {
      const updatedOrder = await rechargeOrdersService.markManualStatus(rechargeOrderId, normalizedDecision);
      return {
        order: updatedOrder,
        proof
      };
    }

    const updatedProof = await paymentProofsRepository.markReviewed(proof.id, {
      reviewStatus: normalizedDecision,
      reviewedByUserId,
      reviewerNotes: reviewerNotes || null
    });

    let updatedOrder;
    if (normalizedDecision === 'approved') {
      updatedOrder = await rechargeOrdersService.approve(rechargeOrderId);
    } else {
      updatedOrder = await rechargeOrdersService.reject(rechargeOrderId, { id: reviewedByUserId });
    }

    return {
      order: updatedOrder,
      proof: updatedProof
    };
  }

  async downloadProofFileForOrder(rechargeOrderId) {
    const { proof } = await this.getLatestForOrder(rechargeOrderId);
    if (!proof.metaMediaId && !proof.fileContentBase64) {
      throw new AppError('Comprovante nao possui arquivo vinculado', 404);
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

    throw new AppError('Arquivo do comprovante indisponivel', 404);
  }

  async downloadProofFile(rechargeRequestId) {
    const { proof } = await this.getLatestByRechargeRequestId(rechargeRequestId);
    if (!proof.metaMediaId && !proof.fileContentBase64) {
      throw new AppError('Comprovante nao possui arquivo vinculado', 404);
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

    throw new AppError('Arquivo do comprovante indisponivel', 404);
  }
}

module.exports = new PaymentProofsService();
