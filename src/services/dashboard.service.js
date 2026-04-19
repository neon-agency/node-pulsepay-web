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
        lucro
      },
      distribuicaoPorServidor,
      alertasEstoque
    };
  }
}

module.exports = new DashboardService();
