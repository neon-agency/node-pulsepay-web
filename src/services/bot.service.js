const sessionsRepository = require('../repositories/bot-sessions.repository');
const integrationsService = require('./bot-integrations.service');
const credentialsService = require('./credentials.service');
const rechargeRequestsService = require('./recharge-requests.service');
const paymentProofsService = require('./payment-proofs.service');
const usersRepository = require('../repositories/users.repository');

const STAGES = {
  START: 'START',
  ASK_PANEL: 'ASK_PANEL',
  ASK_DOUBT: 'ASK_DOUBT',
  ASK_PANEL_EMAIL: 'ASK_PANEL_EMAIL',
  ASK_SERVER: 'ASK_SERVER',
  ASK_QUANTITY: 'ASK_QUANTITY',
  CONFIRM_SUMMARY: 'CONFIRM_SUMMARY',
  AWAIT_PAYMENT_PROOF: 'AWAIT_PAYMENT_PROOF'
};

const END_CONVERSATION_ID = 'end:conversation';
const END_CONVERSATION_TITLE = '🛑 Encerrar';
const SUMMARY_CONFIRM_ID = 'summary:confirm';
const SUMMARY_EDIT_QUANTITY_ID = 'summary:edit-quantity';
const SUMMARY_CANCEL_ID = 'summary:cancel';
const SERVER_NEXT_PREFIX = 'server:next:';
const SERVER_PREV_PREFIX = 'server:prev:';
const SERVER_LIST_PAGE_SIZE = 8;
const IDLE_WARNING_MS = 3 * 60 * 1000;
const IDLE_CLOSE_MS = 5 * 60 * 1000;
const GREETINGS = new Set(['oi', 'ola', 'olá', 'bom dia', 'boa tarde', 'boa noite', 'menu', 'iniciar', 'comecar', 'começar']);

class BotService {
  isGreeting(value) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return GREETINGS.has(normalized);
  }

  formatMoney(value) {
    const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
    return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  parsePanelEmail(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
    return normalized;
  }

  normalizeServerButtonTitle(name) {
    const cleanName = String(name || '').trim() || 'Servidor';
    return cleanName.length <= 20 ? cleanName : `${cleanName.slice(0, 17)}...`;
  }

  buildServerChoices(servers) {
    return (servers || []).map((server) => ({
      buttonId: `server:${server.serverId}`,
      title: this.normalizeServerButtonTitle(server.servidor),
      serverId: String(server.serverId),
      serverName: String(server.servidor || '').trim(),
      unitPrice: Number(server.effectivePrice)
    }));
  }

  resolveServerSelection(serverChoices, input) {
    if (!Array.isArray(serverChoices) || !input) return null;
    return serverChoices.find((choice) => choice.buttonId === String(input).trim()) || null;
  }

  buildServerPrompt(serverChoices, isFirstPrompt = false) {
    const header = isFirstPrompt
      ? 'Excelente! 🚀 Agora selecione o *Servidor* vinculado à sua credencial:'
      : 'Selecione um servidor 👇';

    const lines = serverChoices.map((choice, index) =>
      `${index + 1}. *${choice.serverName}* - ${this.formatMoney(choice.unitPrice)} por crédito`
    );

    return [
      header,
      '',
      ...lines,
      '',
      'Abra a lista interativa e toque no servidor desejado.',
      'Se quiser, use o botão *Encerrar*.'
    ].join('\n');
  }

  isServerNavigation(input) {
    return String(input || '').startsWith(SERVER_NEXT_PREFIX) || String(input || '').startsWith(SERVER_PREV_PREFIX);
  }

  resolveServerPage(input, currentPage = 0) {
    const value = String(input || '');

    if (value.startsWith(SERVER_NEXT_PREFIX)) {
      return Number.parseInt(value.slice(SERVER_NEXT_PREFIX.length), 10);
    }

    if (value.startsWith(SERVER_PREV_PREFIX)) {
      return Number.parseInt(value.slice(SERVER_PREV_PREFIX.length), 10);
    }

    return currentPage;
  }

  withEndConversationButton(buttons) {
    const hasEnd = buttons.some((item) => item.id === END_CONVERSATION_ID);
    if (hasEnd) return buttons;
    return [...buttons, { id: END_CONVERSATION_ID, title: END_CONVERSATION_TITLE }];
  }

  async sendServerList(sendList, serverChoices, isFirstPrompt = false, page = 0) {
    const totalPages = Math.max(1, Math.ceil(serverChoices.length / SERVER_LIST_PAGE_SIZE));
    const safePage = Math.min(Math.max(Number(page) || 0, 0), totalPages - 1);
    const start = safePage * SERVER_LIST_PAGE_SIZE;
    const visibleChoices = serverChoices.slice(start, start + SERVER_LIST_PAGE_SIZE);

    const rows = visibleChoices.map((choice) => ({
      id: choice.buttonId,
      title: choice.title,
      description: `${choice.serverName} • ${this.formatMoney(choice.unitPrice)} por crédito`
    }));

    if (safePage > 0) {
      rows.push({
        id: `${SERVER_PREV_PREFIX}${safePage - 1}`,
        title: '⬅️ Voltar',
        description: 'Mostra os servidores anteriores'
      });
    }

    if (safePage < totalPages - 1) {
      rows.push({
        id: `${SERVER_NEXT_PREFIX}${safePage + 1}`,
        title: '➡️ Próximos',
        description: 'Mostra mais servidores'
      });
    }

    rows.push({
      id: END_CONVERSATION_ID,
      title: END_CONVERSATION_TITLE,
      description: 'Finaliza o atendimento'
    });

    const baseTitle = isFirstPrompt
      ? 'Excelente! 🚀 Agora selecione o *Servidor* vinculado à sua credencial:'
      : 'Selecione um servidor 👇';

    const title = totalPages > 1 ? `${baseTitle}\n\nPágina ${safePage + 1} de ${totalPages}` : baseTitle;

    await sendList(title, 'Ver servidores', rows);
    return safePage;
  }

  async sendServerPicker(sendList, sendButtons, sendText, serverChoices, isFirstPrompt = false, page = 0) {
    const title = isFirstPrompt
      ? 'Excelente! 🚀 Agora selecione o *Servidor* vinculado à sua credencial:'
      : 'Selecione um servidor 👇';

    if (serverChoices.length <= 3) {
      const buttons = serverChoices.map((choice) => ({
        id: choice.buttonId,
        title: choice.title
      }));

      await sendButtons(title, buttons);
      return 0;
    }

    try {
      return await this.sendServerList(sendList, serverChoices, isFirstPrompt, page);
    } catch (error) {
      console.error('Falha ao enviar lista de servidores; usando fallback em texto:', error);
      await sendText(this.buildServerPrompt(serverChoices, isFirstPrompt));
      await sendButtons('Toque em *Encerrar* ou tente novamente em instantes.', []);
      return Math.max(Number(page) || 0, 0);
    }
  }

  parseReviewCommand(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    const approve = raw.match(/^1\s+(\S+)\s*$/i);
    if (approve) {
      return { decision: 'approved', rechargeRequestId: approve[1], notes: null };
    }
    const reject = raw.match(/^0\s+(\S+)(?:\s+([\s\S]+))?$/i);
    if (reject) {
      return {
        decision: 'rejected',
        rechargeRequestId: reject[1],
        notes: reject[2] ? reject[2].trim() : null
      };
    }
    return null;
  }

  async handleReviewCommand({ from, sendText, command }) {
    let user;
    try {
      user = await usersRepository.findByWhatsappPhone(from);
    } catch (error) {
      console.error('Falha ao buscar admin para comando de revisao:', error);
      return false;
    }

    if (!user || user.role !== 'admin' || !user.isActive) {
      return false;
    }

    try {
      await paymentProofsService.reviewLatest({
        rechargeRequestId: command.rechargeRequestId,
        reviewedByUserId: user.id,
        decision: command.decision,
        reviewerNotes: command.notes
      });

      const label = command.decision === 'approved' ? 'aprovada' : 'recusada';
      await sendText(`Recarga ${command.rechargeRequestId} ${label} com sucesso. ✅`);
    } catch (error) {
      console.error('Falha ao processar comando de revisao:', error);
      const message = error?.message || 'Erro desconhecido';
      await sendText(`Não consegui processar o comando. ${message}`);
    }
    return true;
  }

  async processIncomingMessage({ from, text, messageType = 'text', media = null, messageId = null }) {
    const session = await sessionsRepository.getOrCreate(from);
    const previousInteractionAt = session.lastUserMessageAt
      ? new Date(session.lastUserMessageAt).getTime()
      : null;
    const interactionAt = new Date().toISOString();

    const sendText = async (message) => integrationsService.sendWhatsAppText(from, message);
    const sendButtons = async (message, buttons, options = { includeEnd: true }) => {
      const prepared = options.includeEnd ? this.withEndConversationButton(buttons) : buttons;
      await integrationsService.sendWhatsAppButtons(from, message, prepared);
    };
    const sendList = async (message, buttonText, rows) => integrationsService.sendWhatsAppList(from, message, buttonText, rows);

    const reviewCommand = this.parseReviewCommand(text);
    if (reviewCommand) {
      const handled = await this.handleReviewCommand({ from, sendText, command: reviewCommand });
      if (handled) {
        return;
      }
    }

    if (previousInteractionAt && session.stage && session.stage !== STAGES.START) {
      const inactiveForMs = Date.now() - previousInteractionAt;

      if (inactiveForMs >= IDLE_CLOSE_MS) {
        await sessionsRepository.reset(from);
        await sendText('Atendimento encerrado por inatividade. Caso queira renovar novamente, basta nos chamar! 👋');
        if (!this.isGreeting(text)) {
          return;
        }
      }

      if (inactiveForMs >= IDLE_WARNING_MS) {
        await sendText('Está aí ainda? 😊');
      }
    }

    session.lastUserMessageAt = interactionAt;
    session.idleReminderSentAt = null;

    if (text === END_CONVERSATION_ID || text?.toLowerCase() === 'encerrar') {
      await sessionsRepository.reset(from);
      await sendText('Conversa encerrada. Quando quiser voltar, é só mandar uma mensagem. 👋');
      return;
    }

    if (text?.toLowerCase() === 'reset' || text?.toLowerCase() === 'voltar' || text?.toLowerCase() === 'cancelar') {
      session.stage = STAGES.START;
      await sendText('Sem problemas! Vamos reiniciar o seu atendimento. 🔄');
    }

    switch (session.stage) {
      case STAGES.START:
        await sendButtons(
          'Olá! 👋 Bem-vindo ao *Atendimento Inteligente PulsePay*.\n\nSua renovação de planos de forma simples e rápida. Como posso ajudar?',
          [
            { id: '1', title: '⚡ NOVA RECARGA' },
            { id: '2', title: '❓ DÚVIDAS' }
          ]
        );
        session.stage = STAGES.ASK_PANEL;
        break;

      case STAGES.ASK_PANEL:
        if (text === '1') {
          await sendButtons(
            'Perfeito! ✅\n\nEnvie o *email de login do painel* vinculado à sua credencial.\n\n*Exemplo:*\n`seuemail@dominio.com`',
            []
          );
          session.stage = STAGES.ASK_PANEL_EMAIL;
          break;
        }

        if (text === '2') {
          await sendButtons('Com certeza! ✍️\n\nMe envie sua dúvida e eu vou encaminhar para nossa equipe agora mesmo.', []);
          session.stage = STAGES.ASK_DOUBT;
          break;
        }

        await sendButtons(
          'Escolha uma das opções para continuar 👇',
          [
            { id: '1', title: '⚡ NOVA RECARGA' },
            { id: '2', title: '❓ DÚVIDAS' }
          ]
        );
        session.stage = STAGES.ASK_PANEL;
        break;

      case STAGES.ASK_DOUBT:
        if (!text || !text.trim()) {
          await sendButtons('Pode me descrever sua dúvida em uma mensagem?', []);
          break;
        }

        await sendText('Perfeito! ✅\n\nRecebemos sua dúvida e um de nossos atendentes entrará em contato com você em instantes.');
        session.stage = STAGES.START;
        break;

      case STAGES.ASK_PANEL_EMAIL: {
        const panelEmail = this.parsePanelEmail(text);
        if (!panelEmail) {
          await sendButtons(
            'Não consegui entender. Envie o *email de login do painel*.\n\n*Exemplo:* `seuemail@dominio.com`',
            []
          );
          break;
        }

        try {
          const resolved = await credentialsService.resolveCredentialByEmail({ email: panelEmail });

          const serverChoices = this.buildServerChoices(resolved.servers || []);
          if (!serverChoices.length) {
            await sendText('⚠️ Esse email não possui servidores ativos vinculados.');
            session.stage = STAGES.START;
            break;
          }

          session.credential = resolved.credential;
          session.panelEmail = resolved.email;
          session.serverChoices = serverChoices;
          session.serverPage = await this.sendServerPicker(sendList, sendButtons, sendText, serverChoices, true, 0);
          session.stage = STAGES.ASK_SERVER;
          break;
        } catch (error) {
          console.error('Erro ao resolver credencial por email no bot:', error);
          if (error?.statusCode === 404) {
            await sendButtons(
              '❌ Não encontrei credencial com esse *email*.\n\nConfira se o email está igual ao cadastro e tente novamente.\n*Exemplo:* `seuemail@dominio.com`',
              []
            );
            session.stage = STAGES.ASK_PANEL_EMAIL;
            break;
          }

          if (error?.statusCode === 409) {
            await sendButtons(
              `⚠️ ${error.message}\n\nSe precisar, envie novamente o *email do painel*.\n*Exemplo:* \`seuemail@dominio.com\``,
              []
            );
            session.stage = STAGES.ASK_PANEL_EMAIL;
            break;
          }

          await sendButtons(
            '❌ Não consegui validar esse email agora por um erro interno.\n\nTente novamente em instantes ou chame o suporte.',
            []
          );
          session.stage = STAGES.ASK_PANEL_EMAIL;
          break;
        }
      }

      case STAGES.ASK_SERVER: {
        if (this.isServerNavigation(text)) {
          const nextPage = this.resolveServerPage(text, session.serverPage || 0);
          session.serverPage = await this.sendServerPicker(
            sendList,
            sendButtons,
            sendText,
            session.serverChoices,
            false,
            nextPage
          );
          break;
        }

        const selectedServer = this.resolveServerSelection(session.serverChoices, text);

        if (selectedServer) {
          session.panel_id = selectedServer.serverId;
          session.panel_name = selectedServer.serverName;
          session.unitPrice = Number(selectedServer.unitPrice);
          session.login = session.panelEmail;
          await sendButtons(`Perfeito! Servidor *${session.panel_name}* selecionado.\n\nAgora me informe quantos créditos você deseja recarregar.`, []);
          session.stage = STAGES.ASK_QUANTITY;
          break;
        }

        if (Array.isArray(session.serverChoices) && session.serverChoices.length > 0) {
          await sendText('Ops! Escolha uma opção na lista de servidores.');
          session.serverPage = await this.sendServerPicker(
            sendList,
            sendButtons,
            sendText,
            session.serverChoices,
            false,
            session.serverPage || 0
          );
          break;
        }

        await sendText('Não encontrei os servidores desta sessão. Vamos recomeçar. 🔄');
        session.stage = STAGES.START;
        break;
      }

      case STAGES.ASK_QUANTITY:
        if (text && text.length >= 1) {
          const qty = parseInt(text, 10);
          if (Number.isNaN(qty) || qty <= 0) {
            await sendButtons('⚠️ Por favor, digite um número inteiro para a quantidade de créditos.', []);
            break;
          }

          session.quantity = qty;
          session.total = Number((qty * Number(session.unitPrice || 0)).toFixed(2));

          const summary = [
            '📊 *RESUMO DO PEDIDO*',
            '━━━━━━━━━━━━━━',
            `👤 *Email do painel:* ${session.panelEmail}`,
            `🔹 *Servidor:* ${session.panel_name}`,
            `🔹 *Quantidade:* ${qty} unidade(s)`,
            `💳 *Valor unitário:* ${this.formatMoney(session.unitPrice)}`,
            `💰 *Total:* ${this.formatMoney(session.total)}`,
            '━━━━━━━━━━━━━━'
          ].join('\n');

          await sendButtons(`${summary}\n\nConfira o resumo acima e escolha como deseja continuar 👇`, [
            { id: SUMMARY_CONFIRM_ID, title: '✅ Continuar' },
            { id: SUMMARY_EDIT_QUANTITY_ID, title: '✏️ Alterar quantidade' },
            { id: SUMMARY_CANCEL_ID, title: '❌ Cancelar' }
          ], { includeEnd: false });
          session.stage = STAGES.CONFIRM_SUMMARY;
          break;
        }

        await sendButtons('Informe uma quantidade válida para continuar.', []);
        break;

      case STAGES.CONFIRM_SUMMARY:
        if (text === SUMMARY_EDIT_QUANTITY_ID) {
          await sendButtons('Sem problemas. Informe a *nova quantidade de créditos* que você deseja:', []);
          session.stage = STAGES.ASK_QUANTITY;
          break;
        }

        if (text === SUMMARY_CANCEL_ID) {
          await sendText('Pedido cancelado com sucesso. Se quiser iniciar uma nova recarga, é só me chamar. 👋');
          session.stage = STAGES.START;
          break;
        }

        if (text === SUMMARY_CONFIRM_ID) {
          try {
            const rechargeRequest = await rechargeRequestsService.create({
              credentialId: session.credential?.id,
              serverId: session.panel_id,
              accountLogin: session.login,
              quantity: session.quantity,
              unitPrice: session.unitPrice,
              paymentMethod: 'pix',
              requestedByPhone: from
            });

            session.rechargeRequestId = rechargeRequest.id;
            const { pix_key: pixKey } = integrationsService.getBotConfig();

            await rechargeRequestsService.updatePayment(session.rechargeRequestId, {
              paymentStatus: 'pix_gerado',
              paymentMethod: 'pix',
              pixCode: pixKey,
              pixTxid: null
            });

            await sendText(`🧾 Solicitação de recarga: *${session.rechargeRequestId}*`);
            await sendText('Você pode pagar usando a *Chave Pix* abaixo:');
            await sendText(`🔑 \`${pixKey}\``);
            await sendText('Agora envie o *comprovante do Pix* em imagem ou PDF para seguirmos com a validação. 📎');
            session.stage = STAGES.AWAIT_PAYMENT_PROOF;
            break;
          } catch (error) {
            console.error('Erro ao gerar Pix no bot:', error);
            const { pix_key: pixKey } = integrationsService.getBotConfig();
            await sendText('❌ *Erro Temporário:* Não consegui gerar o código dinâmico agora.');
            await sendText(`Você pode pagar usando a *Chave Pix* abaixo:\n\n🔑 \`${pixKey}\``);
            await sendText('Depois do pagamento, envie o comprovante em imagem ou PDF para análise.');
            session.stage = STAGES.AWAIT_PAYMENT_PROOF;
            break;
          }
        }

        await sendButtons('Escolha uma opção para continuar com o pedido 👇', [
          { id: SUMMARY_CONFIRM_ID, title: '✅ Continuar' },
          { id: SUMMARY_EDIT_QUANTITY_ID, title: '✏️ Alterar quantidade' },
          { id: SUMMARY_CANCEL_ID, title: '❌ Cancelar' }
        ], { includeEnd: false });
        break;

      case STAGES.AWAIT_PAYMENT_PROOF:
        if (session.rechargeRequestId && media && ['image', 'document'].includes(messageType)) {
          try {
            await paymentProofsService.createFromBotMessage({
              rechargeRequestId: session.rechargeRequestId,
              senderPhone: from,
              messageId,
              media
            });

            await sendText('Recebemos seu comprovante e ele foi encaminhado para análise e validação. ⏳');
            await sendText(`Assim que a conferência da recarga *${session.rechargeRequestId}* for concluída, avisaremos você.`);
            session.stage = STAGES.START;
            break;
          } catch (error) {
            console.error('Erro ao processar comprovante do Pix:', error);
            await sendText('Não consegui processar esse comprovante. Tente enviar novamente em imagem ou PDF.');
            break;
          }
        }

        await sendButtons('Para concluir, envie o *comprovante do Pix* em imagem ou PDF aqui no chat.', []);
        break;

      default:
        await sessionsRepository.reset(from);
        await this.processIncomingMessage({ from, text: '' });
        return;
    }

    await sessionsRepository.save(from, session);
  }
}

module.exports = new BotService();
