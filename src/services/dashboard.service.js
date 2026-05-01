const db = require('../database/knex');
const clientsRepository = require('../repositories/clients.repository');
const serversRepository = require('../repositories/servers.repository');

function toMoney(value) {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
}

function safePercent(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function startOf(period) {
  const now = new Date();
  if (period === 'dia') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'semana') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'mes') {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return new Date(0);
}

class DashboardService {
  async resellersRanking({ period = 'all', limit = 20 } = {}) {
    const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
    const cutoff = period && period !== 'all' ? startOf(period) : null;

    let query = db('recharge_requests as rr')
      .innerJoin('credentials as c', 'c.id', 'rr.credential_id')
      .innerJoin('clients as cl', 'cl.id', 'c.client_id')
      .where('rr.payment_status', 'pago')
      .groupBy('cl.id', 'cl.nome', 'cl.email', 'cl.telefone', 'cl.tipo')
      .select(
        'cl.id as client_id',
        'cl.nome as client_nome',
        'cl.email as client_email',
        'cl.telefone as client_telefone',
        'cl.tipo as client_tipo',
        db.raw('SUM(rr.quantity)::int as total_credits'),
        db.raw('SUM(rr.total_amount)::numeric as total_amount'),
        db.raw('COUNT(rr.id)::int as total_orders'),
        db.raw('MAX(rr.updated_at) as last_purchase_at')
      )
      .orderBy('total_amount', 'desc')
      .limit(normalizedLimit);

    if (cutoff) {
      query = query.where('rr.updated_at', '>=', cutoff);
    }

    const rows = await query;

    return rows.map((row, index) => ({
      position: index + 1,
      clientId: row.client_id,
      clientNome: row.client_nome,
      clientEmail: row.client_email,
      clientTelefone: row.client_telefone,
      clientTipo: row.client_tipo,
      totalCredits: Number(row.total_credits) || 0,
      totalAmount: toMoney(Number(row.total_amount) || 0),
      totalOrders: Number(row.total_orders) || 0,
      lastPurchaseAt: row.last_purchase_at
    }));
  }

  async serversRanking({ period = 'all', limit = 50 } = {}) {
    const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 200);
    const cutoff = period && period !== 'all' ? startOf(period) : null;

    let query = db('recharge_requests as rr')
      .innerJoin('servers as s', 's.id', 'rr.server_id')
      .where('rr.payment_status', 'pago')
      .groupBy('s.id', 's.servidor', 's.custo_credito')
      .select(
        's.id as server_id',
        's.servidor as server_nome',
        's.custo_credito as custo_credito',
        db.raw('SUM(rr.quantity)::int as total_credits'),
        db.raw('SUM(rr.total_amount)::numeric as total_amount'),
        db.raw('COUNT(rr.id)::int as total_orders'),
        db.raw('MAX(rr.updated_at) as last_purchase_at')
      )
      .orderBy('total_credits', 'desc')
      .limit(normalizedLimit);

    if (cutoff) {
      query = query.where('rr.updated_at', '>=', cutoff);
    }

    const rows = await query;

    return rows.map((row, index) => {
      const credits = Number(row.total_credits) || 0;
      const bruto = Number(row.total_amount) || 0;
      const custo = Number(row.custo_credito) || 0;
      const liquido = bruto - credits * custo;
      return {
        position: index + 1,
        serverId: row.server_id,
        servidor: row.server_nome,
        totalCredits: credits,
        totalAmount: toMoney(bruto),
        totalLiquid: toMoney(liquido),
        totalOrders: Number(row.total_orders) || 0,
        lastPurchaseAt: row.last_purchase_at
      };
    });
  }

  async resellerDetails({ clientId, period = 'all' } = {}) {
    if (!clientId) {
      return { clientId: null, totals: { credits: 0, amount: 0, orders: 0 }, origins: [] };
    }
    const cutoff = period && period !== 'all' ? startOf(period) : null;

    let query = db('recharge_requests as rr')
      .innerJoin('credentials as c', 'c.id', 'rr.credential_id')
      .innerJoin('servers as s', 's.id', 'rr.server_id')
      .where('c.client_id', clientId)
      .groupBy('s.id', 's.servidor')
      .select(
        's.id as server_id',
        's.servidor as server_nome',
        db.raw('SUM(rr.quantity)::int as total_credits'),
        db.raw('SUM(rr.total_amount)::numeric as total_amount'),
        db.raw('COUNT(rr.id)::int as total_orders')
      )
      .orderBy('total_amount', 'desc');

    if (cutoff) {
      query = query.where('rr.updated_at', '>=', cutoff);
    }

    const rows = await query;

    const origins = rows.map((row) => ({
      serverId: row.server_id,
      servidor: row.server_nome,
      totalCredits: Number(row.total_credits) || 0,
      totalAmount: toMoney(Number(row.total_amount) || 0),
      totalOrders: Number(row.total_orders) || 0
    }));

    const totals = origins.reduce(
      (acc, o) => {
        acc.credits += o.totalCredits;
        acc.amount = toMoney(acc.amount + o.totalAmount);
        acc.orders += o.totalOrders;
        return acc;
      },
      { credits: 0, amount: 0, orders: 0 }
    );

    return { clientId, totals, origins };
  }

  async finances({ period = 'all' } = {}) {
    const cutoff = period && period !== 'all' ? startOf(period) : null;

    const servers = await serversRepository.findAll();
    const custoByServerId = new Map(servers.map((s) => [String(s.id), Number(s.custoCredito ?? 0)]));

    let query = db('recharge_requests')
      .where('payment_status', 'pago')
      .select('server_id', 'quantity', 'total_amount', 'created_at', 'updated_at');

    if (cutoff) {
      query = query.where('updated_at', '>=', cutoff);
    }

    const paidRecharges = await query;

    const byServer = new Map();
    for (const recharge of paidRecharges) {
      const sid = String(recharge.server_id);
      const custo = custoByServerId.get(sid) ?? 0;
      const bruto = Number(recharge.total_amount) || 0;
      const qty = Number(recharge.quantity) || 0;
      const liquido = bruto - qty * custo;
      const current = byServer.get(sid) || {
        serverId: recharge.server_id,
        servidor: servers.find((s) => String(s.id) === sid)?.servidor || '—',
        totalCredits: 0,
        totalBruto: 0,
        totalLiquido: 0,
        totalOrders: 0
      };
      current.totalCredits += qty;
      current.totalBruto += bruto;
      current.totalLiquido += liquido;
      current.totalOrders += 1;
      byServer.set(sid, current);
    }

    const servidores = Array.from(byServer.values())
      .map((row) => ({
        ...row,
        totalBruto: toMoney(row.totalBruto),
        totalLiquido: toMoney(row.totalLiquido)
      }))
      .sort((a, b) => b.totalBruto - a.totalBruto);

    const totals = servidores.reduce(
      (acc, row) => {
        acc.credits += row.totalCredits;
        acc.bruto = toMoney(acc.bruto + row.totalBruto);
        acc.liquido = toMoney(acc.liquido + row.totalLiquido);
        acc.orders += row.totalOrders;
        return acc;
      },
      { credits: 0, bruto: 0, liquido: 0, orders: 0 }
    );

    return { totals, servidores };
  }

  _normalizeRecharge(r) {
    return {
      paymentStatus: r.paymentStatus ?? r.payment_status ?? null,
      createdAt: r.createdAt ?? r.created_at ?? null,
      serverId: r.serverId ?? r.server_id ?? null,
      quantity: Number(r.quantity ?? 0),
      totalAmount: Number(r.totalAmount ?? r.total_amount ?? 0)
    };
  }

  _computeSummary({ clients, servers, allRecharges }) {
    const normalized = allRecharges.map((r) => this._normalizeRecharge(r));

    const totalRevenda = clients.filter((c) => String(c.tipo || '').toLowerCase() === 'revenda').length;

    const custoByServerId = new Map(servers.map((s) => [String(s.id), Number(s.custoCredito ?? 0)]));

    const paidRecharges = normalized.filter((r) => r.paymentStatus === 'pago');
    const startOfDay = startOf('dia');
    const todayRecharges = normalized.filter((r) => r.createdAt && new Date(r.createdAt) >= startOfDay);

    const recargasDoDia = todayRecharges.reduce(
      (acc, r) => {
        acc.solicitadas += 1;
        if (r.paymentStatus === 'pago') acc.aprovadas += 1;
        else if (r.paymentStatus === 'pendente_pagamento' || r.paymentStatus === 'pix_gerado') acc.faltas += 1;
        return acc;
      },
      { solicitadas: 0, aprovadas: 0, faltas: 0 }
    );

    const periods = ['dia', 'semana', 'mes'];
    const creditosVendidos = {};
    const lucro = {};

    for (const period of periods) {
      const cutoff = startOf(period);
      const subset = paidRecharges.filter((r) => new Date(r.createdAt) >= cutoff);
      const totalQty = subset.reduce((acc, r) => acc + r.quantity, 0);
      const totalLucro = subset.reduce((acc, r) => {
        const custo = custoByServerId.get(String(r.serverId)) ?? 0;
        return acc + (r.totalAmount - r.quantity * custo);
      }, 0);
      creditosVendidos[period] = totalQty;
      lucro[period] = toMoney(totalLucro);
    }

    const totalClientes = clients.length;

    const byServerId = clients.reduce((acc, client) => {
      const serverId = String(client.servidor || '');
      if (!serverId) return acc;
      acc[serverId] = (acc[serverId] || 0) + 1;
      return acc;
    }, {});

    const lucroByServerId = paidRecharges.reduce((acc, r) => {
      const sid = String(r.serverId);
      const custo = custoByServerId.get(sid) ?? 0;
      acc[sid] = (acc[sid] || 0) + (r.totalAmount - r.quantity * custo);
      return acc;
    }, {});

    const distribuicaoPorServidor = servers.map((server) => {
      const sid = String(server.id);
      const total = byServerId[sid] || 0;
      return {
        serverId: server.id,
        servidor: server.servidor,
        clientes: total,
        lucroTotal: toMoney(lucroByServerId[sid] || 0),
        percentual: safePercent(total, totalClientes)
      };
    });

    const alertasEstoque = servers
      .filter((s) => s.estoqueAlerta != null && s.estoque < s.estoqueAlerta)
      .map((s) => ({
        serverId: s.id,
        servidor: s.servidor,
        estoque: s.estoque,
        estoqueAlerta: s.estoqueAlerta
      }));

    return {
      cards: {
        totalRevenda: { total: totalRevenda },
        creditosVendidos,
        lucro,
        recargasDoDia
      },
      distribuicaoPorServidor,
      alertasEstoque
    };
  }

  async summary() {
    const [clients, servers, allRecharges] = await Promise.all([
      clientsRepository.findAll(),
      serversRepository.findAll(),
      db('recharge_requests').select('server_id', 'quantity', 'total_amount', 'created_at', 'payment_status')
    ]);

    return this._computeSummary({ clients, servers, allRecharges });
  }

  async pageBundle() {
    // Lightweight projections — dashboard summary only needs `tipo` + `servidor_id` from clients
    // and `server_id`, `quantity`, `total_amount`, `payment_status`, `created_at` from recharges.
    // Full clients / recharge_requests are NOT consumed by the dashboard page.
    const [servers, clients, allRecharges] = await Promise.all([
      serversRepository.findAll(),
      db('clients').select('id', 'tipo', db.raw('servidor_id as servidor')),
      db('recharge_requests').select(
        'server_id',
        'quantity',
        'total_amount',
        'payment_status',
        'created_at'
      )
    ]);

    const dashboard = this._computeSummary({ clients, servers, allRecharges });

    return { servers, dashboard };
  }
}

module.exports = new DashboardService();
