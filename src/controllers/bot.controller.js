const botService = require('../services/bot.service');

class BotController {
  parseIncomingText(message) {
    if (!message) return null;

    if (message.type === 'interactive') {
      const interactive = message.interactive || {};
      if (interactive.type === 'button_reply') return interactive.button_reply?.id?.trim();
      if (interactive.type === 'list_reply') return interactive.list_reply?.id?.trim();
      return null;
    }

    if (message.type === 'text') {
      return message.text?.body?.trim();
    }

    return null;
  }

  async handleWebhook(rawBody) {
    let payload;

    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      console.error('Erro ao parsear JSON do webhook:', error);
      return;
    }

    const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message?.from) return;

    const text = this.parseIncomingText(message) || '';
    await botService.processIncomingMessage({
      from: message.from,
      text
    });

    return { ok: true };
  }
}

module.exports = new BotController();
