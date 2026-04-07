const sessionsRepository = require('../repositories/bot-sessions.repository');
const integrationsService = require('./bot-integrations.service');
const credentialsService = require('./credentials.service');
const rechargeRequestsService = require('./recharge-requests.service');
const paymentProofsService = require('./payment-proofs.service');

const STAGES = {
  START: 'START',
  ASK_PANEL: 'ASK_PANEL',
  ASK_DOUBT: 'ASK_DOUBT',
  ASK_CREDENTIAL_COMBINED: 'ASK_CREDENTIAL_COMBINED',
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
const IDLE_WARNING_MS = 3 * 60 * 1000;
const IDLE_CLOSE_MS = 5 * 60 * 1000;

class BotService {
  formatMoney(value) {
    const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
    return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  sanitizeLast4(value) {
    return String(value || '').replace(/\D/g, '').slice(-4);
  }

  parseCredentialInput(value) {
    const normalized = String(value || '').trim().replace(/\s+/g, ' ');
    const match = normalized.match(/^(.*?)[\s\-_/.,:;]+(\d{4})$/);
    if (!match) {
      return null;
    }

    const name = String(match[1] || '').trim();
    const last4 = this.sanitizeLast4(match[2]);
    if (!name || last4.length !== 4) {
      return null;
    }

    return { name, last4 };
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
    return serverChoices.find((choice) => choice.buttonId === input) || null;
  }

  withEndConversationButton(buttons) {
    const hasEnd = buttons.some((item) => item.id === END_CONVERSATION_ID);
    if (hasEnd) return buttons;
    return [...buttons, { id: END_CONVERSATION_ID, title: END_CONVERSATION_TITLE }];
  }

  async sendServerList(sendList, serverChoices, isFirstPrompt = false) {
    const currentRows = serverChoices.map((choice) => ({
      id: choice.buttonId,
      title: choice.title,
      description: choice.serverName
    }));

    currentRows.push({
      id: END_CONVERSATION_ID,
      title: END_CONVERSATION_TITLE,
      description: 'Finaliza o atendimento'
    });

    const title = isFirstPrompt
      ? 'Excelente! 🚀 Agora selecione o *Servidor* vinculado à sua credencial:'
      : 'Selecione um servidor 👇';

    await sendList(
      title,
      'Ver servidores',
      currentRows.map((row) => {
        if (!row.id.startsWith('server:')) return row;
        const choice = serverChoices.find((item) => item.buttonId === row.id);
        if (!choice) return row;
        return {
          ...row,
          description: `${choice.serverName} • ${this.formatMoney(choice.unitPrice)} por crédito`
        };
      })
    );

    return 0;
  }

  async sendServerPicker(sendList, sendButtons, serverChoices, isFirstPrompt = false) {
    try {
      return await this.sendServerList(sendList, serverChoices, isFirstPrompt);
    } catch (error) {
      // Fallback para provedores que não suportam lista interativa.
      console.error('Falha ao enviar lista de servidores; usando fallback de botões:', error);

      const buttons = serverChoices.map((choice) => ({
        id: choice.buttonId,
        title: choice.title
      }));

      buttons.push({ id: END_CONVERSATION_ID, title: END_CONVERSATION_TITLE });

      const title = isFirstPrompt
        ? 'Excelente! 🚀 Agora selecione o *Servidor* vinculado à sua credencial:'
        : 'Selecione um servidor 👇';

      await sendButtons(title, buttons, { includeEnd: false });
      return 0;
    }
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

    if (previousInteractionAt && session.stage && session.stage !== STAGES.START) {
      const inactiveForMs = Date.now() - previousInteractionAt;

      if (inactiveForMs >= IDLE_CLOSE_MS) {
        await sessionsRepository.reset(from);
        await sendText('Esse atendimento foi encerrado por falta de interação. Vamos começar de novo. 👋');
        await this.processIncomingMessage({ from, text: '', messageType: 'text', media: null, messageId: null });
        return;
      }

      if (inactiveForMs >= IDLE_WARNING_MS) {
        await sendText('Você ainda está aí? Vamos continuar de onde paramos. 🙂');
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
            'Perfeito! ✅\n\nEnvie o *nome + os 4 últimos dígitos da credencial na mesma mensagem*.\n\n*Formato correto:*\n`joao 1265`\n`maria silva 4321`'
            ,
            []
          );
          session.stage = STAGES.ASK_CREDENTIAL_COMBINED;
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

      case STAGES.ASK_CREDENTIAL_COMBINED: {
        const parsedCredential = this.parseCredentialInput(text);
        if (!parsedCredential) {
          await sendButtons(
            'Não consegui entender. Envie *nome + 4 dígitos* na mesma mensagem.\n\n*Exemplo:*\n`joao 1265`',
            []
          );
          break;
        }

        try {
          const resolved = await credentialsService.resolveCredentialWithServers({
            nome: parsedCredential.name,
            last4: parsedCredential.last4
          });

          const serverChoices = this.buildServerChoices(resolved.servers || []);
          if (!serverChoices.length) {
            await sendText('⚠️ Sua credencial não possui servidores ativos vinculados.');
            session.stage = STAGES.START;
            break;
          }

          session.credential = resolved.credential;
          session.credentialName = parsedCredential.name;
          session.serverChoices = serverChoices;
          session.serverPage = await this.sendServerPicker(sendList, sendButtons, serverChoices, true);
          session.stage = STAGES.ASK_SERVER;
          break;
        } catch (error) {
          console.error('Erro ao resolver credencial no bot:', error);
          if (error?.statusCode === 404) {
            await sendButtons(
              '❌ Não encontrei uma credencial com esse *nome + 4 dígitos*.\n\nConfira se o nome está igual ao cadastro e tente novamente.\n*Exemplo:* `joao 1265`',
              []
            );
            session.stage = STAGES.ASK_CREDENTIAL_COMBINED;
            break;
          }

          if (error?.statusCode === 409) {
            await sendButtons(
              `⚠️ ${error.message}\n\nSe precisar, envie novamente no formato:\n*Exemplo:* \`joao 1265\``,
              []
            );
            session.stage = STAGES.ASK_CREDENTIAL_COMBINED;
            break;
          }

          await sendButtons(
            '❌ Não consegui validar essa credencial agora por um erro interno.\n\nTente novamente em instantes ou chame o suporte.',
            []
          );
          session.stage = STAGES.ASK_CREDENTIAL_COMBINED;
          break;
        }
      }

      case STAGES.ASK_SERVER: {
        const selectedServer = this.resolveServerSelection(session.serverChoices, text);

        if (selectedServer) {
          session.panel_id = selectedServer.serverId;
          session.panel_name = selectedServer.serverName;
          session.unitPrice = Number(selectedServer.unitPrice);
          session.login = session.credential?.nome || session.credentialName;
          await sendButtons(`Perfeito! Servidor *${session.panel_name}* selecionado.\n\nAgora me informe quantos créditos você deseja recarregar.`, []);
          session.stage = STAGES.ASK_QUANTITY;
          break;
        }

        if (Array.isArray(session.serverChoices) && session.serverChoices.length > 0) {
          await sendText('Ops! Escolha uma opção na lista de servidores.');
          session.serverPage = await this.sendServerPicker(sendList, sendButtons, session.serverChoices, false);
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
            `👤 *Usuário:* ${session.credential?.nome || session.credentialName} (${session.credential?.last4 || '****'})`,
            `🔹 *Servidor:* ${session.panel_name}`,
            `🔹 *Quantidade:* ${qty} unidade(s)`,
            `💳 *Valor unitário:* ${this.formatMoney(session.unitPrice)}`,
            `💰 *Total:* ${this.formatMoney(session.total)}`,
            '━━━━━━━━━━━━━━'
          ].join('\n');

          await sendButtons(`${summary}\n\nConfira o resumo acima e escolha como deseja continuar 👇`, [
            { id: SUMMARY_CONFIRM_ID, title: '✅ Continuar' },
            { id: SUMMARY_EDIT_QUANTITY_ID, title: '✏️ Alterar qtd' },
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
            await sendText(`Você pode pagar usando a *Chave Pix* abaixo:\n\n🔑 \`${pixKey}\``);
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
          { id: SUMMARY_EDIT_QUANTITY_ID, title: '✏️ Alterar qtd' },
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
