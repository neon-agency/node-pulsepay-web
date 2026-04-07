const bot = require('../bot');

module.exports = async function handler(req, res) {
  console.log(`[Vercel Webhook] Chamada recebida - Method: ${req.method}`);

  if (req.method === 'POST') {
    try {
      // No Vercel, o body já vem parseado se for JSON pela infraestrutura deles
      const body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;

      const bodyLength = typeof body === 'string' ? body.length : 0;
      console.log(`[Vercel Webhook] Payload recebido (${bodyLength} chars)`);

      // Responde imediatamente ao WhatsApp para evitar timeout da função serverless.
      res.status(200).send('OK');

      // Continua o processamento em background sem bloquear a resposta HTTP.
      Promise.resolve()
        .then(() => bot.handleWebhook(body))
        .then(() => {
          console.log('[Vercel Webhook] Processado com sucesso');
        })
        .catch((error) => {
          console.error('[Vercel Webhook] Erro async:', error);
        });

      return;
    } catch (error) {
      console.error("[Vercel Webhook] Erro crítico:", error);
      return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
  }

  if (req.method === 'GET') {
    // Captura o challenge do WhatsApp/Facebook se houver
    const challenge = req.query['hub.challenge'];
    if (challenge) {
      console.log("[Vercel Webhook] Respondendo hub.challenge:", challenge);
      return res.status(200).send(challenge);
    }
    
    console.log("[Vercel Webhook] GET simples recebido");
    return res.status(200).send('Webhook endpoint ativo (Vercel API)');
  }

  return res.status(405).send('Method Not Allowed');
};
