const sessionsRepository = require('../repositories/bot-sessions.repository');
const integrationsService = require('./bot-integrations.service');

const STAGES = {
  START: 'START',
  ASK_PANEL: 'ASK_PANEL',
  ASK_DOUBT: 'ASK_DOUBT',
  ASK_CREDENTIAL_NAME: 'ASK_CREDENTIAL_NAME',
  ASK_CREDENTIAL_LAST4: 'ASK_CREDENTIAL_LAST4',
  ASK_SERVER: 'ASK_SERVER',
  ASK_ACCOUNT: 'ASK_ACCOUNT',
  ASK_QUANTITY: 'ASK_QUANTITY',
  ASK_PAYMENT: 'ASK_PAYMENT',
  COMPLETING: 'COMPLETING'
};

const SERVER_LIST_PAGE_SIZE = 4;
const SERVER_NEXT_PAGE_ID = 'server:more';
const END_CONVERSATION_ID = 'end:conversation';
const END_CONVERSATION_TITLE = '🛑 Encerrar';

class BotService {
  formatMoney(value) {
    const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
    return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  sanitizeLast4(value) {
    return String(value || '').replace(/\D/g, '').slice(-4);
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

  async sendEndConversationOption(sendButtons) {
    await sendButtons('Se desejar, você pode encerrar a conversa agora.', [
      { id: END_CONVERSATION_ID, title: END_CONVERSATION_TITLE }
    ], { includeEnd: false });
  }

  async sendServerList(sendList, serverChoices, page = 0, isFirstPrompt = false) {
    const totalPages = Math.max(1, Math.ceil(serverChoices.length / SERVER_LIST_PAGE_SIZE));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const start = safePage * SERVER_LIST_PAGE_SIZE;
    const end = start + SERVER_LIST_PAGE_SIZE;
    const currentRows = serverChoices.slice(start, end).map((choice) => ({
      id: choice.buttonId,
      title: choice.title,
      description: choice.serverName
    }));

    if (end < serverChoices.length) {
      currentRows.push({
        id: SERVER_NEXT_PAGE_ID,
        title: '➡️ Próximos',
        description: `Página ${safePage + 2} de ${totalPages}`
      });
    }

    currentRows.push({
      id: END_CONVERSATION_ID,
      title: END_CONVERSATION_TITLE,
      description: 'Finaliza o atendimento'
    });

    const title = isFirstPrompt
      ? `Excelente! 🚀 Agora selecione o *Servidor* vinculado à sua credencial:\n\nPágina ${safePage + 1}/${totalPages}`
      : `Selecione um servidor 👇\n\nPágina ${safePage + 1}/${totalPages}`;

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

    return safePage;
  }

  async processIncomingMessage({ from, text }) {
    const session = sessionsRepository.getOrCreate(from);

    const sendText = async (message) => integrationsService.sendWhatsAppText(from, message);
    const sendButtons = async (message, buttons, options = { includeEnd: true }) => {
      const prepared = options.includeEnd ? this.withEndConversationButton(buttons) : buttons;
      await integrationsService.sendWhatsAppButtons(from, message, prepared);
    };
    const sendList = async (message, buttonText, rows) => integrationsService.sendWhatsAppList(from, message, buttonText, rows);

    if (text === END_CONVERSATION_ID || text?.toLowerCase() === 'encerrar') {
      sessionsRepository.reset(from);
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
          await sendText('Perfeito! ✅ Para continuar, informe o *nome* usado na credencial:');
          await this.sendEndConversationOption(sendButtons);
          session.stage = STAGES.ASK_CREDENTIAL_NAME;
          break;
        }

        if (text === '2') {
          await sendText('Com certeza! ✍️\n\nMe envie sua dúvida e eu vou encaminhar para nossa equipe agora mesmo.');
          await this.sendEndConversationOption(sendButtons);
          session.stage = STAGES.ASK_DOUBT;
          break;
        }

        session.stage = STAGES.START;
        await this.processIncomingMessage({ from, text: '' });
        break;

      case STAGES.ASK_DOUBT:
        if (!text || !text.trim()) {
          await sendText('Pode me descrever sua dúvida em uma mensagem?');
          await this.sendEndConversationOption(sendButtons);
          break;
        }

        await sendText('Perfeito! ✅\n\nRecebemos sua dúvida e um de nossos atendentes entrará em contato com você em instantes.');
        session.stage = STAGES.START;
        break;

      case STAGES.ASK_CREDENTIAL_NAME:
        if (!text || text.trim().length < 2) {
          await sendText('Por favor, informe um nome válido para continuar.');
          await this.sendEndConversationOption(sendButtons);
          break;
        }

        session.credentialName = text.trim();
        await sendText('Ótimo! Agora envie os *4 últimos dígitos* da sua credencial:');
        await this.sendEndConversationOption(sendButtons);
        session.stage = STAGES.ASK_CREDENTIAL_LAST4;
        break;

      case STAGES.ASK_CREDENTIAL_LAST4: {
        const last4 = this.sanitizeLast4(text);
        if (last4.length !== 4) {
          await sendText('Os últimos 4 dígitos precisam ter exatamente 4 números. Tente novamente:');
          await this.sendEndConversationOption(sendButtons);
          break;
        }

        try {
          const resolved = await integrationsService.resolveCredentialFromApi({
            nome: session.credentialName,
            last4,
            telefone: from
          });

          const serverChoices = this.buildServerChoices(resolved.servers || []);
          if (!serverChoices.length) {
            await sendText('⚠️ Sua credencial não possui servidores ativos vinculados.');
            session.stage = STAGES.START;
            break;
          }

          session.credential = resolved.credential;
          session.serverChoices = serverChoices;
          session.serverPage = await this.sendServerList(sendList, serverChoices, 0, true);
          session.stage = STAGES.ASK_SERVER;
          break;
        } catch (error) {
          console.error('Erro ao resolver credencial no bot:', error);
          await sendText(
            '❌ Não consegui validar essa credencial. Confira nome + últimos 4 dígitos e se o *WhatsApp* é o mesmo telefone cadastrado no painel do cliente.'
          );
          session.stage = STAGES.ASK_CREDENTIAL_NAME;
          break;
        }
      }

      case STAGES.ASK_SERVER: {
        if (text === SERVER_NEXT_PAGE_ID && Array.isArray(session.serverChoices) && session.serverChoices.length > 0) {
          const totalPages = Math.max(1, Math.ceil(session.serverChoices.length / SERVER_LIST_PAGE_SIZE));
          const nextPage = ((session.serverPage || 0) + 1) % totalPages;
          session.serverPage = await this.sendServerList(sendList, session.serverChoices, nextPage, false);
          break;
        }

        const selectedServer = this.resolveServerSelection(session.serverChoices, text);

        if (selectedServer) {
          session.panel_id = selectedServer.serverId;
          session.panel_name = selectedServer.serverName;
          session.unitPrice = Number(selectedServer.unitPrice);
          await sendText(`Perfeito! Servidor *${session.panel_name}* selecionado.\n\nAgora me informe o *Login / Nº da Conta* para recarga:`);
          await this.sendEndConversationOption(sendButtons);
          session.stage = STAGES.ASK_ACCOUNT;
          break;
        }

        if (Array.isArray(session.serverChoices) && session.serverChoices.length > 0) {
          await sendText('Ops! Escolha uma opção na lista de servidores.');
          session.serverPage = await this.sendServerList(sendList, session.serverChoices, session.serverPage || 0, false);
          break;
        }

        await sendText('Não encontrei os servidores desta sessão. Vamos recomeçar. 🔄');
        session.stage = STAGES.START;
        break;
      }

      case STAGES.ASK_ACCOUNT:
        if (text && text.length >= 2) {
          session.login = text;
          await sendText(`Conta *${session.login}* identificada! ✅\n\nQuantos créditos você deseja recarregar hoje? (Ex: 1, 3, 10...)`);
          await this.sendEndConversationOption(sendButtons);
          session.stage = STAGES.ASK_QUANTITY;
          break;
        }

        await sendText('O login informado parece muito curto. Por favor, confira e digite novamente:');
        await this.sendEndConversationOption(sendButtons);
        break;

      case STAGES.ASK_QUANTITY:
        if (text && text.length >= 1) {
          const qty = parseInt(text, 10);
          if (Number.isNaN(qty) || qty <= 0) {
            await sendText('⚠️ Por favor, digite um número inteiro para a quantidade de créditos.');
            await this.sendEndConversationOption(sendButtons);
            break;
          }

          session.quantity = qty;
          session.total = Number((qty * Number(session.unitPrice || 0)).toFixed(2));

          const summary = [
            '📊 *RESUMO DO PEDIDO*',
            '━━━━━━━━━━━━━━',
            `👤 *Usuário:* ${session.credential?.nome || session.credentialName} (${session.credential?.last4 || '****'})`,
            `🔹 *Servidor:* ${session.panel_name}`,
            `🔹 *Conta:* ${session.login}`,
            `🔹 *Quantidade:* ${qty} unidade(s)`,
            `💳 *Valor unitário:* ${this.formatMoney(session.unitPrice)}`,
            `💰 *Total:* ${this.formatMoney(session.total)}`,
            '━━━━━━━━━━━━━━',
            'Selecione a forma de pagamento abaixo:'
          ].join('\n');

          await sendButtons(summary, [
            { id: '1', title: 'PIX ⚡ (Instantâneo)' },
            { id: '2', title: 'CRIPTO ₿' }
          ]);
          session.stage = STAGES.ASK_PAYMENT;
          break;
        }

        await sendText('Informe uma quantidade válida para continuar.');
        await this.sendEndConversationOption(sendButtons);
        break;

      case STAGES.ASK_PAYMENT:
        if (text === '1') {
          await sendText('⏳ *Aguarde um momento...* Estou gerando o seu código Pix exclusivo para esta transação.');

          try {
            const rechargeRequest = await integrationsService.createRechargeRequest({
              credentialId: session.credential?.id,
              serverId: session.panel_id,
              accountLogin: session.login,
              quantity: session.quantity,
              unitPrice: session.unitPrice,
              paymentMethod: 'pix',
              requestedByPhone: from
            });

            session.rechargeRequestId = rechargeRequest.id;
            const paymentResult = await integrationsService.callPaymentApi({
              provider: 'efi',
              method: 'pix',
              amount: Math.round(session.total * 100),
              currency: 'BRL',
              description: `Renovação ${session.panel_name} - ${session.login}`,
              pix_key: integrationsService.getBotConfig().pix_key,
              customer: {
                name: `WhatsApp ${from}`,
                email: `${from}@whatsapp.com`,
                cpf: '00000000000'
              },
              metadata: {
                login: session.login,
                phone: from,
                plan_id: session.panel_id
              }
            });

            if (!paymentResult.copy_paste) {
              throw new Error('API não retornou o código Pix.');
            }

            await integrationsService.updateRechargeRequestPayment(session.rechargeRequestId, {
              paymentStatus: 'pix_gerado',
              paymentMethod: 'pix',
              pixCode: paymentResult.copy_paste,
              pixTxid: paymentResult.txid || paymentResult.id || null
            });

            await sendText('✅ *Pix gerado com sucesso!*');
            await sendText(`🧾 Solicitação de recarga: *${session.rechargeRequestId}*`);
            await sendText(`Copia e Cola:\n\n\`${paymentResult.copy_paste}\``);
            await sendText('Clique no código acima para copiar, pague no seu banco e o acesso será liberado em instantes! 🚀');
            session.stage = STAGES.COMPLETING;
            break;
          } catch (error) {
            console.error('Erro ao gerar Pix no bot:', error);
            const { pix_key: pixKey } = integrationsService.getBotConfig();
            await sendText('❌ *Erro Temporário:* Não consegui gerar o código dinâmico agora.');
            await sendText(`Mas não se preocupe! Você pode pagar usando nossa *Chave Pix Fixa* abaixo:\n\n🔑 \`${pixKey}\``);
            await sendText('Após pagar, envie o comprovante aqui para agilizar seu processo.');
            session.stage = STAGES.COMPLETING;
            break;
          }
        }

        if (text === '2') {
          try {
            const rechargeRequest = await integrationsService.createRechargeRequest({
              credentialId: session.credential?.id,
              serverId: session.panel_id,
              accountLogin: session.login,
              quantity: session.quantity,
              unitPrice: session.unitPrice,
              paymentMethod: 'cripto',
              requestedByPhone: from
            });
            session.rechargeRequestId = rechargeRequest.id;
          } catch (error) {
            console.error('Erro ao criar recarga cripto no bot:', error);
          }

          const criptoWallet = process.env.CRIPTO_WALLET || 'SUA_CARTEIRA_CRIPTO_AQUI';
          if (session.rechargeRequestId) {
            await sendText(`🧾 Solicitação de recarga: *${session.rechargeRequestId}*`);
          }
          await sendText(`💎 *Pagamento via Cripto*\n\nDeposite na carteira abaixo:\n\n\`${criptoWallet}\`\n\nApós o envio, encaminhe o comprovante aqui.`);
          session.stage = STAGES.COMPLETING;
          break;
        }

        await sendButtons('Selecione a forma de pagamento para continuar 👇', [
          { id: '1', title: 'PIX ⚡' },
          { id: '2', title: 'CRIPTO ₿' }
        ]);
        break;

      case STAGES.COMPLETING:

        if (text?.toLowerCase().includes('comprovante') || text?.includes('✅') || text?.toLowerCase() === 'paguei') {
          if (session.rechargeRequestId) {
            try {
              await integrationsService.updateRechargeRequestPayment(session.rechargeRequestId, {
                paymentStatus: 'pago'
              });
            } catch (error) {
              console.error('Erro ao atualizar status de pagamento da recarga:', error);
            }
          }

          await sendText('Recebemos sua mensagem! Nosso sistema está verificando o pagamento. ⏳');
          setTimeout(async () => {
            await sendText('RECARGA FINALIZADA ✅\n\n*Acesso Liberado!* Muito obrigado por escolher a PulsePay. 🤝');
          }, 5000);
          session.stage = STAGES.START;
          break;
        }

        await sendText('Quando finalizar o pagamento, envie aqui: *paguei* ou o comprovante para concluirmos sua recarga.');
        await this.sendEndConversationOption(sendButtons);
        break;

      default:
        sessionsRepository.reset(from);
        await this.processIncomingMessage({ from, text: '' });
    }
  }
}

module.exports = new BotService();
