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

const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'America/Sao_Paulo';

// Period filtering is by CALENDAR DATE in the business timezone — not a rolling
// 24h window. "dia" = every row whose BRT date equals today's BRT date (00:00
// to 23:59 of that calendar day). "semana"/"mes" = BRT date >= today minus 7/30
// calendar days (so 7 → 8 days incl. today, 30 → 31 days incl. today).
const PERIOD_DAYS = { semana: 7, mes: 30 };

// 'YYYY-MM-DD' for an instant, rendered in the business timezone.
function brtDateStr(value) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(value));
}

// Subtract whole calendar days from a 'YYYY-MM-DD' string (DST-proof: pure
// calendar math in UTC, no clock involved).
function dateStrMinusDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

// Adds the period filter to a knex query by comparing the BRT calendar date of
// `column` against today's BRT calendar date — entirely in SQL, so it does not
// depend on the Node host timezone.
function applyPeriodFilter(query, column, period) {
  if (!period || period === 'all') return query;
  if (period === 'dia') {
    return query.whereRaw(
      `(?? AT TIME ZONE ?)::date = (now() AT TIME ZONE ?)::date`,
      [column, APP_TIME_ZONE, APP_TIME_ZONE]
    );
  }
  const days = PERIOD_DAYS[period];
  if (!days) return query;
  return query.whereRaw(
    `(?? AT TIME ZONE ?)::date >= (now() AT TIME ZONE ?)::date - ?::int`,
    [column, APP_TIME_ZONE, APP_TIME_ZONE, days]
  );
}

// Validates a 'YYYY-MM' month string and returns { start, nextStart } as
// 'YYYY-MM-DD' calendar-date bounds (first day of the month, first day of the
// following month). Returns null if the string is malformed.
function monthBounds(month) {
  if (typeof month !== 'string') return null;
  const match = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (m < 1 || m > 12) return null;
  const pad = (n) => String(n).padStart(2, '0');
  const start = `${y}-${pad(m)}-01`;
  const nextStart = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
  return { start, nextStart };
}

// Adds a calendar-month filter: BRT date of `column` within [start, nextStart).
// Covers the 1st through the last day of the selected month, inclusive.
function applyMonthFilter(query, column, month) {
  const bounds = monthBounds(month);
  if (!bounds) return query;
  return query.whereRaw(
    `(?? AT TIME ZONE ?)::date >= ?::date AND (?? AT TIME ZONE ?)::date < ?::date`,
    [column, APP_TIME_ZONE, bounds.start, column, APP_TIME_ZONE, bounds.nextStart]
  );
}

// JS-side equivalent of applyPeriodFilter for in-memory rows (dashboard summary).
function dateStrMatchesPeriod(recDateStr, todayStr, period) {
  if (!period || period === 'all') return true;
  if (period === 'dia') return recDateStr === todayStr;
  const days = PERIOD_DAYS[period];
  if (!days) return true;
  return recDateStr >= dateStrMinusDays(todayStr, days);
}

// SQL fragment: does this recharge_requests row (alias `rr`) have a payment proof
// attached? A proof links either by recharge_request_id (legacy flow) or by
// recharge_order_id (new orders flow). Used to keep proofless orders out of the
// "solicitadas/pendentes" counters — only attached orders are counted.
const HAS_PROOF_SQL = `EXISTS (
  SELECT 1 FROM recharge_request_payment_proofs p
  WHERE p.recharge_request_id = rr.id
     OR (rr.order_id IS NOT NULL AND p.recharge_order_id = rr.order_id)
) as has_proof`;

class DashboardService {
  async resellersRanking({ period = 'all', limit = 20 } = {}) {
    const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);

    let query = db('recharge_requests as rr')
      .innerJoin('credentials as c', 'c.id', 'rr.credential_id')
      .innerJoin('clients as cl', 'cl.id', 'c.client_id')
      .leftJoin('users as u', 'u.client_id', 'cl.id')
      .where('rr.payment_status', 'pago')
      .groupBy('cl.id', 'cl.nome', 'u.email', 'cl.telefone', 'cl.tipo')
      .select(
        'cl.id as client_id',
        'cl.nome as client_nome',
        'u.email as client_email',
        'cl.telefone as client_telefone',
        'cl.tipo as client_tipo',
        db.raw('SUM(rr.quantity)::int as total_credits'),
        db.raw('SUM(rr.total_amount)::numeric as total_amount'),
        db.raw('COUNT(rr.id)::int as total_orders'),
        db.raw('MAX(rr.updated_at) as last_purchase_at')
      )
      .orderBy('total_amount', 'desc')
      .limit(normalizedLimit);

    query = applyPeriodFilter(query, 'rr.updated_at', period);

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

    query = applyPeriodFilter(query, 'rr.updated_at', period);

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

    query = applyPeriodFilter(query, 'rr.updated_at', period);

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

  async finances({ period = 'all', month = null } = {}) {

    // Single SQL: GROUP BY server, JOIN slim servers for name + custo. liquido computed in SQL.
    let query = db('recharge_requests as rr')
      .innerJoin('servers as s', 's.id', 'rr.server_id')
      .where('rr.payment_status', 'pago')
      .groupBy('s.id', 's.servidor', 's.custo_credito')
      .select(
        's.id as server_id',
        's.servidor',
        db.raw('COALESCE(SUM(rr.quantity), 0)::int as total_credits'),
        db.raw('COALESCE(SUM(rr.total_amount), 0)::numeric as total_bruto'),
        db.raw('COALESCE(SUM(rr.total_amount) - SUM(rr.quantity) * s.custo_credito, 0)::numeric as total_liquido'),
        db.raw('COUNT(rr.id)::int as total_orders')
      )
      .orderBy('total_bruto', 'desc');

    // A valid `month` (YYYY-MM) overrides `period` and filters to that calendar
    // month (1st → last day, BRT). Otherwise fall back to the rolling period.
    if (monthBounds(month)) {
      query = applyMonthFilter(query, 'rr.updated_at', month);
    } else {
      query = applyPeriodFilter(query, 'rr.updated_at', period);
    }

    const rows = await query;

    const servidores = rows.map((row) => ({
      serverId: row.server_id,
      servidor: row.servidor,
      totalCredits: Number(row.total_credits) || 0,
      totalBruto: toMoney(Number(row.total_bruto) || 0),
      totalLiquido: toMoney(Number(row.total_liquido) || 0),
      totalOrders: Number(row.total_orders) || 0
    }));

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
      id: r.id ?? null,
      orderId: r.orderId ?? r.order_id ?? null,
      orderStatus: r.orderStatus ?? r.order_status ?? null,
      orderArchived: Boolean(r.orderArchived ?? r.order_archived ?? false),
      paymentStatus: r.paymentStatus ?? r.payment_status ?? null,
      createdAt: r.createdAt ?? r.created_at ?? null,
      serverId: r.serverId ?? r.server_id ?? null,
      quantity: Number(r.quantity ?? 0),
      totalAmount: Number(r.totalAmount ?? r.total_amount ?? 0),
      isPromo: Boolean(r.isPromo ?? r.is_promo ?? false),
      hasProof: Boolean(r.hasProof ?? r.has_proof ?? false)
    };
  }

  _computeSummary({ clients, servers, allRecharges }) {
    const normalized = allRecharges.map((r) => this._normalizeRecharge(r));

    const totalRevenda = clients.filter((c) => String(c.tipo || '').toLowerCase() === 'revenda').length;

    const custoByServerId = new Map(servers.map((s) => [String(s.id), Number(s.custoCredito ?? 0)]));

    const paidRecharges = normalized.filter((r) => r.paymentStatus === 'pago');
    const todayStr = brtDateStr(new Date());

    // Panel is computed PER ORDER (not per item) using the order's workflow `status`
    // column — not `payment_status`, which is legacy and goes stale (an order can be
    // CONCLUIDO while still carrying pix_gerado). One order fans out into N
    // `recharge_requests` rows sharing the same `order_id`, so we dedup by order and
    // keep the first row seen (items of one order share order_status/archived/proof).
    // Archived orders are out of the panel entirely.
    const allOrders = new Map(); // any date — for the approval queue
    const ordersDoDia = new Map(); // today only — for daily activity
    for (const r of normalized) {
      if (r.orderArchived) continue;
      const key = r.orderId != null ? `o${r.orderId}` : `r${r.id}`;
      if (!allOrders.has(key)) allOrders.set(key, r);
      if (r.createdAt && brtDateStr(r.createdAt) === todayStr && !ordersDoDia.has(key)) {
        ordersDoDia.set(key, r);
      }
    }

    // solicitadas = fila de aprovação: pedidos SOLICITADO COM comprovante de QUALQUER
    // data — fica sincronizado com o badge "Pedidos" (GET /recharge-orders/pending-count,
    // mesma regra: status SOLICITADO + comprovante + não arquivado).
    let solicitadas = 0;
    for (const r of allOrders.values()) {
      if (r.orderStatus === 'SOLICITADO' && r.hasProof) solicitadas += 1;
    }

    // aprovadas / faltas = atividade do DIA. aprovadas = CONCLUIDO de hoje;
    // faltas = SOLICITADO de hoje SEM comprovante (revenda ainda não enviou).
    let aprovadas = 0;
    let faltas = 0;
    for (const r of ordersDoDia.values()) {
      if (r.orderStatus === 'CONCLUIDO') aprovadas += 1;
      else if (r.orderStatus === 'SOLICITADO' && !r.hasProof) faltas += 1;
    }

    const recargasDoDia = { solicitadas, aprovadas, faltas };

    const periods = ['dia', 'semana', 'mes'];
    const creditosVendidos = {};
    const lucro = {};
    const recargasPromocionais = {};

    for (const period of periods) {
      const subset = paidRecharges.filter(
        (r) => r.createdAt && dateStrMatchesPeriod(brtDateStr(r.createdAt), todayStr, period)
      );
      const totalQty = subset.reduce((acc, r) => acc + r.quantity, 0);
      const totalLucro = subset.reduce((acc, r) => {
        const custo = custoByServerId.get(String(r.serverId)) ?? 0;
        return acc + (r.totalAmount - r.quantity * custo);
      }, 0);
      creditosVendidos[period] = totalQty;
      lucro[period] = toMoney(totalLucro);
      recargasPromocionais[period] = subset.filter((r) => r.isPromo).length;
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
        recargasDoDia,
        recargasPromocionais
      },
      distribuicaoPorServidor,
      alertasEstoque
    };
  }

  async summary() {
    const [clients, servers, allRecharges] = await Promise.all([
      clientsRepository.findAll(),
      serversRepository.findAll(),
      db('recharge_requests as rr')
        .leftJoin('recharge_orders as o', 'o.id', 'rr.order_id')
        .select(
          'rr.id',
          'rr.order_id',
          'rr.server_id',
          'rr.quantity',
          'rr.total_amount',
          'rr.created_at',
          'rr.payment_status',
          'rr.is_promo',
          'o.status as order_status',
          'o.archived as order_archived',
          db.raw(HAS_PROOF_SQL)
        )
    ]);

    return this._computeSummary({ clients, servers, allRecharges });
  }

  async rankingPage({ period = 'all', limit } = {}) {
    const [resellers, servers] = await Promise.all([
      this.resellersRanking({ period, limit }),
      this.serversRanking({ period, limit })
    ]);
    return { resellers, servers };
  }

  async pageBundle() {
    // Lightweight projections — dashboard summary only needs `tipo` + `servidor_id` from clients
    // and `server_id`, `quantity`, `total_amount`, `payment_status`, `created_at` from recharges.
    // Full clients / recharge_requests are NOT consumed by the dashboard page.
    const [servers, clients, allRecharges] = await Promise.all([
      serversRepository.findAll(),
      db('clients').select('id', 'tipo', db.raw('servidor_id as servidor')),
      db('recharge_requests as rr')
        .leftJoin('recharge_orders as o', 'o.id', 'rr.order_id')
        .select(
          'rr.id',
          'rr.order_id',
          'rr.server_id',
          'rr.quantity',
          'rr.total_amount',
          'rr.payment_status',
          'rr.created_at',
          'o.status as order_status',
          'o.archived as order_archived',
          db.raw(HAS_PROOF_SQL)
        )
    ]);

    const dashboard = this._computeSummary({ clients, servers, allRecharges });

    return { servers, dashboard };
  }
}

module.exports = new DashboardService();
