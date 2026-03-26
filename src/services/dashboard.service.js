const clientsRepository = require('../repositories/clients.repository');
const serversRepository = require('../repositories/servers.repository');

function toMoney(value) {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
}

function safePercent(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function getDaysUntil(dateString) {
  const target = new Date(dateString);
  if (Number.isNaN(target.getTime())) return null;

  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((target.getTime() - today.getTime()) / msPerDay);
}

function parsePlanPrices() {
  try {
    const raw = process.env.PLAN_PRICES_JSON || '{}';
    const parsed = JSON.parse(raw);
    return Object.entries(parsed).reduce((acc, [key, value]) => {
      const numberValue = Number(value);
      if (Number.isFinite(numberValue) && numberValue >= 0) {
        acc[String(key).toLowerCase()] = numberValue;
      }
      return acc;
    }, {});
  } catch (_error) {
    return {};
  }
}

class DashboardService {
  async summary() {
    const [clients, servers] = await Promise.all([
      clientsRepository.findAll(),
      serversRepository.findAll()
    ]);

    const totalClientes = clients.length;
    const clientesAtivos = clients.filter((client) => String(client.status).toLowerCase() === 'ativo').length;
    const taxaRenovacao = safePercent(clientesAtivos, totalClientes);

    const planPrices = parsePlanPrices();

    const receitaTotal = clients.reduce((acc, client) => {
      const planName = String(client.plano || '').toLowerCase();
      const price = planPrices[planName] || 0;
      return acc + price;
    }, 0);

    const bucket = {
      critico: 0,
      atencao: 0,
      ok: 0
    };

    for (const client of clients) {
      const days = getDaysUntil(client.vencimento);
      if (days === null) continue;

      if (days <= 7) {
        bucket.critico += 1;
      } else if (days <= 30) {
        bucket.atencao += 1;
      } else {
        bucket.ok += 1;
      }
    }

    const byServerId = clients.reduce((acc, client) => {
      const serverId = String(client.servidor || '');
      if (!serverId) return acc;
      acc[serverId] = (acc[serverId] || 0) + 1;
      return acc;
    }, {});

    const distribuicaoPorServidor = servers.map((server) => {
      const total = byServerId[String(server.id)] || 0;
      return {
        serverId: server.id,
        servidor: server.servidor,
        clientes: total,
        percentual: safePercent(total, totalClientes)
      };
    });

    const byPlan = clients.reduce((acc, client) => {
      const plano = String(client.plano || 'Sem plano');
      const key = plano.toLowerCase();
      const price = planPrices[key] || 0;

      if (!acc[key]) {
        acc[key] = { plano, clientes: 0, receitaTotal: 0 };
      }

      acc[key].clientes += 1;
      acc[key].receitaTotal += price;
      return acc;
    }, {});

    const distribuicaoDePlanos = Object.values(byPlan).map((item) => ({
      plano: item.plano,
      clientes: item.clientes,
      receitaTotal: toMoney(item.receitaTotal),
      percentual: safePercent(item.clientes, totalClientes)
    }));

    return {
      cards: {
        totalClientes: {
          total: totalClientes,
          ativos: clientesAtivos
        },
        receitaTotal: {
          total: toMoney(receitaTotal),
          currency: 'BRL'
        },
        alertasCriticos: {
          total: bucket.critico,
          descricao: 'Vencem em até 7 dias'
        },
        taxaRenovacao: {
          percentual: taxaRenovacao,
          periodoDias: 30
        }
      },
      distribuicaoPorServidor,
      distribuicaoDePlanos,
      statusDeVencimento: {
        critico: {
          total: bucket.critico,
          label: 'Até 7 dias'
        },
        atencao: {
          total: bucket.atencao,
          label: 'Até 30 dias'
        },
        ok: {
          total: bucket.ok,
          label: 'Acima de 30 dias'
        }
      }
    };
  }
}

module.exports = new DashboardService();
