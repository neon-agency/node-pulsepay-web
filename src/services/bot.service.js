const sessionsRepository = require('../repositories/bot-sessions.repository');
const integrationsService = require('./bot-integrations.service');

const STAGES = {
  START: 'START',
  ASK_PANEL: 'ASK_PANEL',
  ASK_LOGIN: 'ASK_LOGIN',
  ASK_QUANTITY: 'ASK_QUANTITY',
  ASK_PAYMENT: 'ASK_PAYMENT',
  COMPLETING: 'COMPLETING'
};

const PRICE_PER_UNIT = 10.00;
const SERVER_BUTTONS_PAGE_SIZE = 2;
const SERVER_NEXT_PAGE_ID = 'server:more';

class BotService {
  normalizeServerButtonTitle(name) {
    const cleanName = String(name || '').trim() || 'Servidor';
    return cleanName.length <= 20 ? cleanName : `${cleanName.slice(0, 17)}...`;
  }

  buildServerChoices(servers) {
    return (servers || []).map((server, index) => ({
      buttonId: `server:${server.id}`,
      numericId: String(index + 1),
      title: this.normalizeServerButtonTitle(server.servidor),
      serverId: String(server.id),
      serverName: String(server.servidor || '').trim()
    }));
  }

  resolveServerSelection(serverChoices, input) {
    if (!Array.isArray(serverChoices) || !input) return null;
    return serverChoices.find((choice) => choice.buttonId === input || choice.numericId === input) || null;
  }

  getServerPageButtons(serverChoices, page = 0) {
    const start = page * SERVER_BUTTONS_PAGE_SIZE;
    const end = start + SERVER_BUTTONS_PAGE_SIZE;
    const pageChoices = serverChoices.slice(start, end);
    const hasMore = end < serverChoices.length;

    const buttons = pageChoices.map((choice) => ({
      id: choice.buttonId,
      title: choice.title
    }));

    if (hasMore) {
      buttons.push({ id: SERVER_NEXT_PAGE_ID, title: '➡️ Mais' });
    }

    return buttons;
  }

  async sendServerButtons(sendButtons, serverChoices, page, isFirstPrompt = false) {
    const totalPages = Math.max(1, Math.ceil(serverChoices.length / SERVER_BUTTONS_PAGE_SIZE));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const buttons = this.getServerPageButtons(serverChoices, safePage);

    const title = isFirstPrompt
      ? `Excelente! 🚀 Primeiramente, selecione o *Servidor* que você deseja recarregar:\n\nPágina ${safePage + 1}/${totalPages}`
      : `Selecione um servidor 👇\n\nPágina ${safePage + 1}/${totalPages}`;

    await sendButtons(title, buttons);
    return safePage;
  }

  async processIncomingMessage({ from, text }) {
    const session = sessionsRepository.getOrCreate(from);

    const sendText = async (message) => integrationsService.sendWhatsAppText(from, message);
    const sendButtons = async (message, buttons) => integrationsService.sendWhatsAppButtons(from, message, buttons);

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
          let serverChoices = [];
          try {
            const servers = await integrationsService.fetchServersFromApi();
            serverChoices = this.buildServerChoices(servers);
          } catch (error) {
            console.error('Erro ao buscar servidores na API:', error);
            await sendText('❌ Não consegui carregar os servidores agora. Tente novamente em instantes.');
            session.stage = STAGES.START;
            break;
          }

          if (!serverChoices.length) {
            await sendText('⚠️ Nenhum servidor disponível no momento. Tente novamente mais tarde.');
            session.stage = STAGES.START;
            break;
          }

          session.serverChoices = serverChoices;
          session.serverPage = 0;
          session.serverPage = await this.sendServerButtons(sendButtons, serverChoices, session.serverPage, true);

          session.stage = STAGES.ASK_LOGIN;
          break;
        }

        if (text === '2') {
          await sendText('Com certeza! Descreva sua dúvida abaixo e um de nossos especialistas entrará em contato em instantes. 🧑‍💻');
          session.stage = STAGES.START;
          break;
        }

        session.stage = STAGES.START;
        await this.processIncomingMessage({ from, text: '' });
        break;

      case STAGES.ASK_LOGIN: {
        if (text === SERVER_NEXT_PAGE_ID && Array.isArray(session.serverChoices) && session.serverChoices.length > 0) {
          const totalPages = Math.max(1, Math.ceil(session.serverChoices.length / SERVER_BUTTONS_PAGE_SIZE));
          const nextPage = ((session.serverPage || 0) + 1) % totalPages;
          session.serverPage = await this.sendServerButtons(sendButtons, session.serverChoices, nextPage, false);
          break;
        }

        const selectedServer = this.resolveServerSelection(session.serverChoices, text);

        if (selectedServer) {
          session.panel_id = selectedServer.serverId;
          session.panel_name = selectedServer.serverName;
          await sendText(`Perfeito! Painel *${session.panel_name}* selecionado.\n\n⚠️ Agora, por favor, me informe o seu *Login* ou *Nº da Conta*:`);
          session.stage = STAGES.ASK_QUANTITY;
          break;
        }

        if (Array.isArray(session.serverChoices) && session.serverChoices.length > 0) {
          await sendText('Ops! Escolha uma opção pelos botões abaixo.');
          session.serverPage = await this.sendServerButtons(sendButtons, session.serverChoices, session.serverPage || 0, false);
          break;
        }

        await sendText('Não encontrei os servidores desta sessão. Vamos recomeçar. 🔄');
        session.stage = STAGES.START;
        break;
      }

      case STAGES.ASK_QUANTITY:
        if (text && text.length >= 2) {
          session.login = text;
          await sendText(`Conta *${session.login}* identificada! ✅\n\nQuantos créditos você deseja recarregar hoje? (Ex: 1, 3, 10...)`);
          session.stage = STAGES.ASK_PAYMENT;
          break;
        }

        await sendText('O login informado parece muito curto. Por favor, confira e digite novamente:');
        break;

      case STAGES.ASK_PAYMENT: {
        const qty = parseInt(text, 10);

        if (Number.isNaN(qty) || qty <= 0) {
          await sendText('⚠️ Por favor, digite um número inteiro para a quantidade de créditos.');
          break;
        }

        session.quantity = qty;
        session.total = qty * PRICE_PER_UNIT;
        const totalStr = session.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const summary = [
          '📊 *RESUMO DO PEDIDO*',
          '━━━━━━━━━━━━━━',
          `🔹 *Painel:* ${session.panel_name}`,
          `🔹 *Conta:* ${session.login}`,
          `🔹 *Quantidade:* ${qty} unidade(s)`,
          `💰 *Total:* ${totalStr}`,
          '━━━━━━━━━━━━━━',
          'Selecione a forma de pagamento abaixo:'
        ].join('\n');

        await sendButtons(summary, [
          { id: '1', title: 'PIX ⚡ (Instantâneo)' },
          { id: '2', title: 'CRIPTO ₿' }
        ]);
        session.stage = STAGES.COMPLETING;
        break;
      }

      case STAGES.COMPLETING:
        if (text === '1') {
          await sendText('⏳ *Aguarde um momento...* Estou gerando o seu código Pix exclusivo para esta transação.');

          try {
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

            await sendText('✅ *Pix gerado com sucesso!*');
            await sendText(`Copia e Cola:\n\n\`${paymentResult.copy_paste}\``);
            await sendText('Clique no código acima para copiar, pague no seu banco e o acesso será liberado em instantes! 🚀');
            break;
          } catch (error) {
            console.error('Erro ao gerar Pix no bot:', error);
            const { pix_key: pixKey } = integrationsService.getBotConfig();
            await sendText('❌ *Erro Temporário:* Não consegui gerar o código dinâmico agora.');
            await sendText(`Mas não se preocupe! Você pode pagar usando nossa *Chave Pix Fixa* abaixo:\n\n🔑 \`${pixKey}\``);
            await sendText('Após pagar, envie o comprovante aqui para agilizar seu processo.');
            break;
          }
        }

        if (text === '2') {
          const criptoWallet = process.env.CRIPTO_WALLET || 'SUA_CARTEIRA_CRIPTO_AQUI';
          await sendText(`💎 *Pagamento via Cripto*\n\nDeposite na carteira abaixo:\n\n\`${criptoWallet}\`\n\nApós o envio, encaminhe o comprovante aqui.`);
          break;
        }

        if (text?.toLowerCase().includes('comprovante') || text?.includes('✅') || text?.toLowerCase() === 'paguei') {
          await sendText('Recebemos sua mensagem! Nosso sistema está verificando o pagamento. ⏳');
          setTimeout(async () => {
            await sendText('RECARGA FINALIZADA ✅\n\n*Acesso Liberado!* Muito obrigado por escolher a PulsePay. 🤝');
          }, 5000);
          session.stage = STAGES.START;
          break;
        }

        await sendButtons('Como deseja finalizar o seu pagamento? 👇', [
          { id: '1', title: 'PIX ⚡' },
          { id: '2', title: 'CRIPTO ₿' }
        ]);
        break;

      default:
        sessionsRepository.reset(from);
        await this.processIncomingMessage({ from, text: '' });
    }
  }
}

module.exports = new BotService();
