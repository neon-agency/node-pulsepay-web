const sessionsRepository = require('../repositories/bot-sessions.repository');
const integrationsService = require('./bot-integrations.service');

const WARNING_AFTER_MS = 3 * 60 * 1000;
const CLOSE_AFTER_MS = 5 * 60 * 1000;

class BotIdleTimeoutsService {
  async processIdleSessions() {
    const now = Date.now();
    const sessions = await sessionsRepository.listActiveSessions();
    let warned = 0;
    let closed = 0;

    for (const session of sessions) {
      const lastInteractionAt = session.lastUserMessageAt
        ? new Date(session.lastUserMessageAt).getTime()
        : null;

      if (!lastInteractionAt || Number.isNaN(lastInteractionAt)) {
        continue;
      }

      const inactiveForMs = now - lastInteractionAt;

      if (inactiveForMs >= CLOSE_AFTER_MS) {
        await integrationsService.sendWhatsAppText(
          session.phone,
          'Encerramos este atendimento por falta de interação. Se quiser continuar depois, é só mandar uma nova mensagem. 👋'
        );
        await sessionsRepository.reset(session.phone);
        closed += 1;
        continue;
      }

      if (inactiveForMs >= WARNING_AFTER_MS && !session.idleReminderSentAt) {
        await integrationsService.sendWhatsAppText(
          session.phone,
          'Você ainda está aí? Se quiser continuar, envie a próxima informação solicitada. Em 2 minutos encerraremos este atendimento automaticamente.'
        );
        await sessionsRepository.save(session.phone, {
          ...session,
          idleReminderSentAt: new Date(now).toISOString()
        });
        warned += 1;
      }
    }

    return {
      warned,
      closed,
      totalActive: sessions.length
    };
  }
}

module.exports = new BotIdleTimeoutsService();
