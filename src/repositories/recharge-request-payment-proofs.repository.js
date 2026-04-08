const db = require('../database/knex');

function clamp(value, maxLength) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

class RechargeRequestPaymentProofsRepository {
  mapRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      rechargeRequestId: row.recharge_request_id,
      senderPhone: row.sender_phone,
      metaMessageId: row.meta_message_id,
      metaMediaId: row.meta_media_id,
      mimeType: row.mime_type,
      fileName: row.file_name,
      caption: row.caption,
      reviewStatus: row.review_status,
      analysisProvider: row.analysis_provider,
      analysisSummary: row.analysis_summary,
      analysisConfidence: row.analysis_confidence === null ? null : Number(row.analysis_confidence),
      extractedAmount: row.extracted_amount === null ? null : Number(row.extracted_amount),
      matchesExpectedAmount: row.matches_expected_amount,
      matchesPixIdentifier: row.matches_pix_identifier,
      rawAnalysisJson: row.raw_analysis_json,
      reviewedByUserId: row.reviewed_by_user_id,
      reviewerNotes: row.reviewer_notes,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async create(payload) {
    const [row] = await db('recharge_request_payment_proofs')
      .insert({
        id: payload.id,
        recharge_request_id: payload.rechargeRequestId,
        sender_phone: clamp(payload.senderPhone, 32),
        meta_message_id: clamp(payload.metaMessageId, 160),
        meta_media_id: clamp(payload.metaMediaId, 160),
        mime_type: clamp(payload.mimeType, 120),
        file_name: clamp(payload.fileName, 255),
        caption: payload.caption || null,
        review_status: payload.reviewStatus || 'pending_review',
        analysis_provider: clamp(payload.analysisProvider, 80),
        analysis_summary: payload.analysisSummary || null,
        analysis_confidence: payload.analysisConfidence ?? null,
        extracted_amount: payload.extractedAmount ?? null,
        matches_expected_amount: payload.matchesExpectedAmount ?? null,
        matches_pix_identifier: payload.matchesPixIdentifier ?? null,
        raw_analysis_json: payload.rawAnalysisJson || null,
        reviewed_by_user_id: payload.reviewedByUserId || null,
        reviewer_notes: payload.reviewerNotes || null,
        reviewed_at: payload.reviewedAt || null
      })
      .returning('*');

    return this.mapRow(row);
  }

  async updateAnalysis(id, payload) {
    const [row] = await db('recharge_request_payment_proofs')
      .where({ id })
      .update({
        review_status: payload.reviewStatus,
        analysis_provider: clamp(payload.analysisProvider, 80),
        analysis_summary: payload.analysisSummary || null,
        analysis_confidence: payload.analysisConfidence ?? null,
        extracted_amount: payload.extractedAmount ?? null,
        matches_expected_amount: payload.matchesExpectedAmount ?? null,
        matches_pix_identifier: payload.matchesPixIdentifier ?? null,
        raw_analysis_json: payload.rawAnalysisJson || null,
        updated_at: db.fn.now()
      })
      .returning('*');

    return this.mapRow(row);
  }

  async markReviewed(id, payload) {
    const [row] = await db('recharge_request_payment_proofs')
      .where({ id })
      .update({
        review_status: payload.reviewStatus,
        reviewed_by_user_id: payload.reviewedByUserId || null,
        reviewer_notes: payload.reviewerNotes || null,
        reviewed_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning('*');

    return this.mapRow(row);
  }

  async findLatestByRechargeRequestId(rechargeRequestId) {
    const row = await db('recharge_request_payment_proofs')
      .where({ recharge_request_id: rechargeRequestId })
      .orderBy('created_at', 'desc')
      .first();

    return this.mapRow(row);
  }

  async findLatestByRechargeRequestIds(rechargeRequestIds) {
    if (!Array.isArray(rechargeRequestIds) || rechargeRequestIds.length === 0) {
      return [];
    }

    const rows = await db('recharge_request_payment_proofs as p')
      .distinctOn('p.recharge_request_id')
      .select('p.*')
      .whereIn('p.recharge_request_id', rechargeRequestIds)
      .orderBy([
        { column: 'p.recharge_request_id', order: 'asc' },
        { column: 'p.created_at', order: 'desc' }
      ]);

    return rows.map((row) => this.mapRow(row));
  }
}

module.exports = new RechargeRequestPaymentProofsRepository();
