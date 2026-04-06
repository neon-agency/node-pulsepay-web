const botService = require('../services/bot.service');

class BotController {
  parseIncomingMessage(message) {
    if (!message) return null;

    if (message.type === 'interactive') {
      const interactive = message.interactive || {};
      if (interactive.type === 'button_reply') {
        return {
          type: 'interactive',
          text: interactive.button_reply?.id?.trim() || ''
        };
      }
      if (interactive.type === 'list_reply') {
        return {
          type: 'interactive',
          text: interactive.list_reply?.id?.trim() || ''
        };
      }
      return { type: 'interactive', text: '' };
    }

    if (message.type === 'text') {
      return {
        type: 'text',
        text: message.text?.body?.trim() || ''
      };
    }

    if (message.type === 'image') {
      return {
        type: 'image',
        text: message.image?.caption?.trim() || '',
        media: {
          id: message.image?.id || null,
          mimeType: message.image?.mime_type || null,
          sha256: message.image?.sha256 || null,
          caption: message.image?.caption || null
        }
      };
    }

    if (message.type === 'document') {
      return {
        type: 'document',
        text: message.document?.caption?.trim() || '',
        media: {
          id: message.document?.id || null,
          mimeType: message.document?.mime_type || null,
          sha256: message.document?.sha256 || null,
          fileName: message.document?.filename || null,
          caption: message.document?.caption || null
        }
      };
    }

    return {
      type: message.type || 'unknown',
      text: ''
    };
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

    const parsed = this.parseIncomingMessage(message) || { type: 'unknown', text: '' };
    await botService.processIncomingMessage({
      from: message.from,
      text: parsed.text,
      messageType: parsed.type,
      media: parsed.media || null,
      messageId: message.id || null
    });

    return { ok: true };
  }
}

module.exports = new BotController();
