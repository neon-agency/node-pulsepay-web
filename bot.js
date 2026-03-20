const http = require('http');

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:8082';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:8083';

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

async function sendWhatsAppRequest(payload) {
  const data = JSON.stringify(payload);
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length,
    },
  };
  
  const url = `${WHATSAPP_SERVICE_URL}/v1/messages/send`;
  
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    });
    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

async function callPaymentAPI(payload) {
  const data = JSON.stringify(payload);
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length,
    },
  };
  
  const url = `${PAYMENT_SERVICE_URL}/api/v1/payments`;
  
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error("Erro ao processar resposta do serviço de pagamento: " + body));
        }
      });
    });
    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

function getBotConfig() {
  return {
    phone_number_id: process.env.BOT_PHONE_NUMBER_ID || 'PENDING_ID',
    access_token: process.env.BOT_ACCESS_TOKEN || 'PENDING_TOKEN'
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
  if (text?.toLowerCase() === 'reset' || text?.toLowerCase() === 'voltar') {
    session.stage = STAGES.START;
  }

  switch (session.stage) {
    case STAGES.START:
      await sendButtons("BOA TARDE, Qual sua necessidade?", [
        { id: '1', title: 'RECARGA' },
        { id: '2', title: 'DÚVIDAS' }
      ]);
      session.stage = STAGES.ASK_PANEL;
      break;

    case STAGES.ASK_PANEL:
      if (text === '1') {
        await sendButtons("Qual Painel ?", [
          { id: '1', title: 'UNITV' },
          { id: '2', title: 'Club' },
          { id: '3', title: 'Fast' }
        ]);
        session.stage = STAGES.ASK_LOGIN;
      } else if (text === '2') {
        await sendText("Por favor, descreva sua dúvida que um de nossos atendentes irá te ajudar.");
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
        await sendText("Qual a sua conta (login) do painel?");
        session.stage = STAGES.ASK_QUANTITY;
      } else {
        await sendButtons("Selecione um painel válido:", [
          { id: '1', title: 'UNITV' },
          { id: '2', title: 'Club' },
          { id: '3', title: 'Fast' }
        ]);
      }
      break;

    case STAGES.ASK_QUANTITY:
      if (text && text.length > 2) { // Supomos login tenha pelo menos 3 caracteres
        session.login = text;
        await sendText("Qual quantidade de créditos deseja recarregar?");
        session.stage = STAGES.ASK_PAYMENT;
      } else {
        await sendText("Por favor, informe um login válido.");
      }
      break;

    case STAGES.ASK_PAYMENT:
      const qty = parseInt(text);
      if (!isNaN(qty) && qty > 0) {
        session.quantity = qty;
        const total = qty * PRICE_PER_UNIT;
        session.total = total;
        const totalStr = total.toFixed(2).replace('.', ',');
        await sendButtons(`${qty}*${PRICE_PER_UNIT}=${totalStr}\n\nForma de pagamento?`, [
          { id: '1', title: 'PIX ⚡' },
          { id: '2', title: 'CRIPTO ₿' }
        ]);
        session.stage = STAGES.COMPLETING;
      } else {
        await sendText("Quantidade inválida. Digite um número.");
      }
      break;

    case STAGES.COMPLETING:
      if (text === '1') {
        await sendText("⏳ Gerando seu Pix, aguarde um momento...");
        
        try {
          const paymentResult = await callPaymentAPI({
            provider: "efi", 
            method: "pix", 
            amount: Math.round(session.total * 100), // Converte para centavos
            currency: "BRL",
            description: `Recarga ${session.panel_name} - ${session.login}`,
            customer: { 
              name: `Cliente WhatsApp ${from}`, 
              email: `${from}@whatsapp.com`, 
              cpf: "00000000000" // Placeholder necessário para EFI
            },
            metadata: { 
              login: session.login, 
              phone: from,
              plan_id: session.panel_id 
            }
          });

          if (paymentResult.copy_paste) {
            await sendText("✅ Pix gerado com sucesso!");
            await sendText(paymentResult.copy_paste);
            await sendText("Após o pagamento nos envie o comprovante.");
          } else {
            throw new Error("Resposta da API sem código Pix");
          }
        } catch (error) {
          console.error("Erro ao gerar Pix:", error);
          await sendText("❌ Ocorreu um erro ao gerar o Pix. Tente novamente mais tarde ou use nossa chave fixa.");
          const pixKey = process.env.PIX_KEY || 'Chave indisponível';
          await sendText(`Chave Pix Fixa:\n${pixKey}`);
        }
        
      } else if (text === '2') {
        const criptoWallet = process.env.CRIPTO_WALLET || 'SUA_CARTEIRA_CRIPT_AQUI';
        await sendText(`Carteira Cripto\n${criptoWallet}\n\nApós o pagamento nos envie o comprovante`);
      } else if (text.toLowerCase().includes('comprovante') || text.includes('✅') || text.toLowerCase() === 'paguei') {
        await sendText("Aguarde que sua recarga será realizada em instantes.");
        
        // Simulação de confirmação
        setTimeout(async () => {
          await sendText("RECARGA FEITA ✅\n\nMuito Obrigado 🤝");
        }, 5000);
        
        session.stage = STAGES.START;
      } else {
        await sendButtons("Escolha uma opção para continuar:", [
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
