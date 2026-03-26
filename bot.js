const http = require('http');
const https = require('https');

// Configuração - Use a URL de produção para que o bot consiga acessar o backend da nuvem
const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:8082';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'https://go-payment-825906875083.europe-west1.run.app';

// Armazenamento de sessões em memória (Telefone -> Estado)
const sessions = {};

const STAGES = {
  START: 'START',
  ASK_PANEL: 'ASK_PANEL',
  ASK_LOGIN: 'ASK_LOGIN',
  ASK_QUANTITY: 'ASK_QUANTITY',
  ASK_PAYMENT: 'ASK_PAYMENT',
  COMPLETING: 'COMPLETING'
};

const PANELS = {
  '1': 'UNITV',
  '2': 'Club',
  '3': 'Fast'
};

const PRICE_PER_UNIT = 10.00; // R$ 10,00

// Helper function to perform requests using either http or https
async function makeRequest(url, payload) {
  const data = JSON.stringify(payload);
  const protocol = url.startsWith('https') ? https : http;

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    },
  };

  return new Promise((resolve, reject) => {
    const req = protocol.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`Status ${res.statusCode}: ${body}`));
        }
        resolve(body);
      });
    });

    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

async function sendWhatsAppRequest(payload) {
  const url = `${WHATSAPP_SERVICE_URL}/v1/messages/send`;
  return makeRequest(url, payload);
}

async function callPaymentAPI(payload) {
  const url = `${PAYMENT_SERVICE_URL}/api/v1/payments`;
  const body = await makeRequest(url, payload);
  try {
    return JSON.parse(body);
  } catch (e) {
    throw new Error("Erro ao processar resposta do serviço de pagamento: " + body);
  }
}

function getBotConfig() {
  return {
    phone_number_id: process.env.BOT_PHONE_NUMBER_ID || 'PENDING_ID',
    access_token: process.env.BOT_ACCESS_TOKEN || 'PENDING_TOKEN',
    pix_key: process.env.PIX_KEY || 'b0944752-7136-49ef-920a-0d21a3aa4be5'
  };
}

async function handleWebhook(body) {
  let jsonPayload;
  try {
    jsonPayload = JSON.parse(body);
  } catch (e) {
    console.error("Erro ao parsear JSON do webhook:", e);
    return;
  }

  const value = jsonPayload.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];

  if (!message) return;

  const from = message.from;
  let text = message.text?.body?.trim();

  // Tratamento de botões iterativos
  if (message.type === 'interactive') {
    const interactive = message.interactive;
    if (interactive.type === 'button_reply') {
      text = interactive.button_reply.id;
    } else if (interactive.type === 'list_reply') {
      text = interactive.list_reply.id;
    }
  }

  const config = getBotConfig();

  if (!sessions[from]) {
    sessions[from] = { stage: STAGES.START };
  }

  const session = sessions[from];

  const sendText = async (msg) => {
    await sendWhatsAppRequest({
      phone_number_id: config.phone_number_id,
      access_token: config.access_token,
      to: from,
      type: 'text',
      message: msg
    });
  };

  const sendButtons = async (title, buttons) => {
    await sendWhatsAppRequest({
      phone_number_id: config.phone_number_id,
      access_token: config.access_token,
      to: from,
      type: 'interactive',
      interactive_type: 'button',
      message: title,
      buttons: buttons.map(b => ({ id: b.id, title: b.title }))
    });
  };

  // Reseta se o usuário digitar algo como sair ou reset
  if (text?.toLowerCase() === 'reset' || text?.toLowerCase() === 'voltar' || text?.toLowerCase() === 'cancelar') {
    session.stage = STAGES.START;
    await sendText("Sem problemas! Vamos reiniciar o seu atendimento. 🔄");
  }

  switch (session.stage) {
    case STAGES.START:
      await sendButtons(
        "Olá! 👋 Bem-vindo ao *Atendimento Inteligente PulsePay*.\n\nSua renovação de planos de forma simples e rápida. Como posso ajudar?",
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
          "Excelente! 🚀 Primeiramente, selecione o *Painel* que você deseja recarregar:",
          [
            { id: '1', title: 'UNITV' },
            { id: '2', title: 'Club' },
            { id: '3', title: 'Fast' },
            { id: '4', title: 'sdsdsd' }
          ]
        );
        session.stage = STAGES.ASK_LOGIN;
      } else if (text === '2') {
        await sendText("Com certeza! Descreva sua dúvida abaixo e um de nossos especialistas entrará em contato em instantes. 🧑‍💻");
        session.stage = STAGES.START;
      } else {
        session.stage = STAGES.START;
        await handleWebhook(body); // Reinicia
      }
      break;

    case STAGES.ASK_LOGIN:
      if (PANELS[text]) {
        session.panel_id = text;
        session.panel_name = PANELS[text];
        await sendText(`Perfeito! Painel *${session.panel_name}* selecionado.\n\n⚠️ Agora, por favor, me informe o seu *Login* ou *Nº da Conta*:`);
        session.stage = STAGES.ASK_QUANTITY;
      } else {
        await sendButtons("Ops! Selecione um painel clicando em um dos botões abaixo: 👇", [
          { id: '1', title: 'UNITV' },
          { id: '2', title: 'Club' },
          { id: '3', title: 'Fast' },
          { id: '4', title: 'sdsdsd' }
        ]);
      }
      break;

    case STAGES.ASK_QUANTITY:
      if (text && text.length >= 2) {
        session.login = text;
        await sendText(`Conta *${session.login}* identificada! ✅\n\nQuantos créditos você deseja recarregar hoje? (Ex: 1, 3, 10...)`);
        session.stage = STAGES.ASK_PAYMENT;
      } else {
        await sendText("O login informado parece muito curto. Por favor, confira e digite novamente:");
      }
      break;

    case STAGES.ASK_PAYMENT:
      const qty = parseInt(text);
      if (!isNaN(qty) && qty > 0) {
        session.quantity = qty;
        const total = qty * PRICE_PER_UNIT;
        session.total = total;
        const totalStr = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const summary = [
          `📊 *RESUMO DO PEDIDO*`,
          `━━━━━━━━━━━━━━`,
          `🔹 *Painel:* ${session.panel_name}`,
          `🔹 *Conta:* ${session.login}`,
          `🔹 *Quantidade:* ${qty} unidade(s)`,
          `💰 *Total:* ${totalStr}`,
          `━━━━━━━━━━━━━━`,
          `Selecione a forma de pagamento abaixo:`
        ].join('\n');

        await sendButtons(summary, [
          { id: '1', title: 'PIX ⚡ (Instantâneo)' },
          { id: '2', title: 'CRIPTO ₿' }
        ]);
        session.stage = STAGES.COMPLETING;
      } else {
        await sendText("⚠️ Por favor, digite um número inteiro para a quantidade de créditos.");
      }
      break;

    case STAGES.COMPLETING:
      if (text === '1') {
        await sendText("⏳ *Aguarde um momento...* Estou gerando o seu código Pix exclusivo para esta transação.");

        try {
          const paymentResult = await callPaymentAPI({
            provider: "efi",
            method: "pix",
            amount: Math.round(session.total * 100), // Converte para centavos
            currency: "BRL",
            description: `Renovação ${session.panel_name} - ${session.login}`,
            pix_key: config.pix_key, // MANDATÓRIO para funcionar na EFI
            customer: {
              name: `WhatsApp ${from}`,
              email: `${from}@whatsapp.com`,
              cpf: "00000000000"
            },
            metadata: {
              login: session.login,
              phone: from,
              plan_id: session.panel_id
            }
          });

          if (paymentResult.copy_paste) {
            await sendText("✅ *Pix gerado com sucesso!*");
            await sendText(`Copia e Cola:\n\n\`${paymentResult.copy_paste}\``);
            await sendText("Clique no código acima para copiar, pague no seu banco e o acesso será liberado em instantes! 🚀");
          } else {
            throw new Error("API não retornou o código Pix.");
          }
        } catch (error) {
          console.error("Erro ao gerar Pix no bot:", error);
          await sendText("❌ *Erro Temporário:* Não consegui gerar o código dinâmico agora.");
          await sendText(`Mas não se preocupe! Você pode pagar usando nossa *Chave Pix Fixa* abaixo:\n\n🔑 \`${config.pix_key}\``);
          await sendText("Após pagar, envie o comprovante aqui para agilizar seu processo.");
        }

      } else if (text === '2') {
        const criptoWallet = process.env.CRIPTO_WALLET || 'SUA_CARTEIRA_CRIPTO_AQUI';
        await sendText(`💎 *Pagamento via Cripto*\n\nDeposite na carteira abaixo:\n\n\`${criptoWallet}\`\n\nApós o envio, encaminhe o comprovante aqui.`);
      } else if (text.toLowerCase().includes('comprovante') || text.includes('✅') || text.toLowerCase() === 'paguei') {
        await sendText("Recebemos sua mensagem! Nosso sistema está verificando o pagamento. ⏳");

        setTimeout(async () => {
          await sendText("RECARGA FINALIZADA ✅\n\n*Acesso Liberado!* Muito obrigado por escolher a PulsePay. 🤝");
        }, 5000);

        session.stage = STAGES.START;
      } else {
        await sendButtons("Como deseja finalizar o seu pagamento? 👇", [
          { id: '1', title: 'PIX ⚡' },
          { id: '2', title: 'CRIPTO ₿' }
        ]);
      }
      break;

    default:
      session.stage = STAGES.START;
      await handleWebhook(body);
  }
}

module.exports = { handleWebhook };
