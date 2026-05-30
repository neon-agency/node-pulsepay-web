const rechargeOrdersService = require('../services/recharge-orders.service');
const paymentProofsService = require('../services/payment-proofs.service');
const AppError = require('../errors/app-error');

function canSeeServerCost(user) {
  return user?.type === 'internal' || user?.role === 'admin';
}

function stripServerCost(order) {
  if (!order) return order;
  const items = Array.isArray(order.items)
    ? order.items.map((item) => {
        const { serverUnitCost: _omit, ...rest } = item;
        return rest;
      })
    : order.items;
  return { ...order, items };
}

async function ensureOrderAccess(req, orderId) {
  const order = await rechargeOrdersService.getById(orderId);

  if (req.user?.type === 'internal' || req.user?.role === 'admin') {
    return order;
  }

  if (req.user?.role !== 'reseller' || !req.user?.clientId) {
    throw new AppError('Acesso negado', 403);
  }

  if (order.clientId !== req.user.clientId) {
    throw new AppError('Acesso negado', 403);
  }

  return order;
}

class RechargeOrdersController {
  async create(req, res) {
    const order = await rechargeOrdersService.createFromCart(req.body || {}, req.user || null);
    const sanitized = canSeeServerCost(req.user) ? order : stripServerCost(order);
    return res.status(201).json(sanitized);
  }

  async getById(req, res) {
    const order = await ensureOrderAccess(req, req.params.id);
    return res.status(200).json(canSeeServerCost(req.user) ? order : stripServerCost(order));
  }

  async page(req, res) {
    let clientId = null;
    if (req.user?.role === 'reseller' && req.user?.clientId) {
      clientId = req.user.clientId;
    }

    const { limit, cursor, search, status, archived } = req.query || {};
    let parsedCursor = null;
    if (typeof cursor === 'string' && cursor.trim()) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        if (parsed?.createdAt && parsed?.id) {
          parsedCursor = { createdAt: parsed.createdAt, id: parsed.id };
        }
      } catch (_err) {
        parsedCursor = null;
      }
    }

    const requireProof = req.user?.role !== 'reseller';
    const data = await rechargeOrdersService.pageBundle({
      clientId,
      limit,
      cursor: parsedCursor,
      search: typeof search === 'string' ? search : null,
      status: typeof status === 'string' ? status : null,
      archived: archived === 'true' || archived === true,
      requireProof
    });

    const encodedNextCursor = data.nextCursor
      ? Buffer.from(JSON.stringify(data.nextCursor), 'utf8').toString('base64')
      : null;

    const rechargeOrders = canSeeServerCost(req.user)
      ? data.rechargeOrders
      : data.rechargeOrders.map(stripServerCost);

    return res.status(200).json({
      rechargeOrders,
      nextCursor: encodedNextCursor
    });
  }

  async pendingCount(req, res) {
    let clientId = null;
    if (req.user?.role === 'reseller' && req.user?.clientId) {
      clientId = req.user.clientId;
    }
    // Admin/internal only count orders that already have a proof attached
    // (mirrors the orders list, which hides proofless orders from reviewers).
    const requireProof = req.user?.role !== 'reseller';
    const count = await rechargeOrdersService.countPending(clientId, { requireProof });
    return res.status(200).json({ count });
  }

  async uploadPaymentProof(req, res) {
    await ensureOrderAccess(req, req.params.id);
    const data = await paymentProofsService.createFromWebUploadForOrder({
      rechargeOrderId: req.params.id,
      user: req.user || null,
      fileName: req.body?.fileName,
      mimeType: req.body?.mimeType,
      contentBase64: req.body?.contentBase64,
      comment: req.body?.comment
    });
    return res.status(201).json(data);
  }

  async reviewLatestPaymentProof(req, res) {
    if (req.user?.type !== 'internal' && req.user?.role !== 'admin') {
      throw new AppError('Acesso negado', 403);
    }

    const data = await paymentProofsService.reviewLatestForOrder({
      rechargeOrderId: req.params.id,
      reviewedByUserId: req.user?.id || null,
      decision: req.body?.decision,
      reviewerNotes: req.body?.reviewerNotes
    });
    return res.status(200).json(data);
  }

  async downloadLatestPaymentProofFile(req, res) {
    await ensureOrderAccess(req, req.params.id);
    const file = await paymentProofsService.downloadProofFileForOrder(req.params.id);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    return res.status(200).send(file.buffer);
  }

  async cancel(req, res) {
    const order = await ensureOrderAccess(req, req.params.id);

    if (req.user?.role === 'reseller' && order.clientId !== req.user?.clientId) {
      throw new AppError('Acesso negado', 403);
    }

    const updated = await rechargeOrdersService.cancelByOwner(req.params.id, req.user || null);
    return res.status(200).json(canSeeServerCost(req.user) ? updated : stripServerCost(updated));
  }

  async archive(req, res) {
    if (req.user?.type !== 'internal' && req.user?.role !== 'admin') {
      throw new AppError('Acesso negado', 403);
    }
    const updated = await rechargeOrdersService.archive(req.params.id);
    return res.status(200).json(updated);
  }
}

module.exports = new RechargeOrdersController();
