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
      .orderBy('total_credits', 'desc')
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

  async summary() {
    const [clients, servers] = await Promise.all([
      clientsRepository.findAll(),
      serversRepository.findAll()
    ]);

    const totalRevenda = clients.filter((c) => String(c.tipo || '').toLowerCase() === 'revenda').length;

    const custoByServerId = new Map(servers.map((s) => [String(s.id), Number(s.custoCredito ?? 0)]));

    const paidRecharges = await db('recharge_requests')
      .where({ payment_status: 'pago' })
      .select('server_id', 'quantity', 'total_amount', 'created_at');

    const startOfDay = startOf('dia');
    const todayRecharges = await db('recharge_requests')
      .where('created_at', '>=', startOfDay)
      .select('payment_status');

    const recargasDoDia = todayRecharges.reduce(
      (acc, r) => {
        acc.solicitadas += 1;
        if (r.payment_status === 'pago') acc.aprovadas += 1;
        else if (r.payment_status === 'pendente_pagamento' || r.payment_status === 'pix_gerado') acc.faltas += 1;
        return acc;
      },
      { solicitadas: 0, aprovadas: 0, faltas: 0 }
    );

    const periods = ['dia', 'semana', 'mes'];
    const creditosVendidos = {};
    const lucro = {};

    for (const period of periods) {
      const cutoff = startOf(period);
      const subset = paidRecharges.filter((r) => new Date(r.created_at) >= cutoff);
      const totalQty = subset.reduce((acc, r) => acc + Number(r.quantity), 0);
      const totalLucro = subset.reduce((acc, r) => {
        const custo = custoByServerId.get(String(r.server_id)) ?? 0;
        return acc + (Number(r.total_amount) - Number(r.quantity) * custo);
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
      const sid = String(r.server_id);
      const custo = custoByServerId.get(sid) ?? 0;
      acc[sid] = (acc[sid] || 0) + (Number(r.total_amount) - Number(r.quantity) * custo);
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
}

module.exports = new DashboardService();
