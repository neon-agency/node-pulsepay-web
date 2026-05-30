class PaymentProofAnalysisService {
  getModel() {
    return process.env.OPENAI_RECEIPT_MODEL || 'gpt-4.1-mini';
  }

  hasOpenAIConfigured() {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  parseJson(text) {
    const cleaned = String(text || '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Resposta da IA nao contem JSON valido');
    }
    return JSON.parse(match[0]);
  }

  buildFallback(expectedAmount) {
    return {
      provider: 'fallback',
      summary: '',
      confidence: 0.15,
      extractedAmount: null,
      matchesExpectedAmount: null,
      matchesPixIdentifier: null,
      raw: {
        reason: 'fallback_manual_review',
        expectedAmount
      }
    };
  }

  async analyzeWithOpenAI({ mimeType, fileBuffer, expectedAmount, pixIdentifier, rechargeId }) {
    const imageBase64 = fileBuffer.toString('base64');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: this.getModel(),
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: [
              'Voce analisa comprovantes PIX em portugues para triagem antifraude.',
              'Responda apenas JSON.',
              'Nunca aprove automaticamente o pagamento; voce apenas estima sinais de consistencia.'
            ].join(' ')
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: [
                  'Analise este comprovante Pix.',
                  `Recarga: ${rechargeId}`,
                  `Valor esperado: ${Number(expectedAmount).toFixed(2)}`,
                  `Identificador Pix esperado: ${pixIdentifier || 'nao informado'}`,
                  'Retorne JSON com o formato:',
                  '{"summary":"texto","confidence":0-1,"extractedAmount":numero|null,"matchesExpectedAmount":true|false|null,"matchesPixIdentifier":true|false|null,"suspiciousSignals":["..."]}'
                ].join('\n')
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI retornou status ${response.status}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const parsed = this.parseJson(content);

    return {
      provider: 'openai',
      summary: typeof parsed.summary === 'string'
        ? parsed.summary
        : 'Comprovante analisado automaticamente e encaminhado para revisao humana.',
      confidence: typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.5,
      extractedAmount: typeof parsed.extractedAmount === 'number' ? parsed.extractedAmount : null,
      matchesExpectedAmount: typeof parsed.matchesExpectedAmount === 'boolean' ? parsed.matchesExpectedAmount : null,
      matchesPixIdentifier: typeof parsed.matchesPixIdentifier === 'boolean' ? parsed.matchesPixIdentifier : null,
      raw: parsed
    };
  }

  async analyze(payload) {
    if (!String(payload.mimeType || '').startsWith('image/')) {
      return {
        ...this.buildFallback(payload.expectedAmount),
        summary: 'Comprovante em documento recebido. A validacao automatica por imagem nao foi aplicada e a revisao humana e obrigatoria.'
      };
    }

    if (!this.hasOpenAIConfigured()) {
      return this.buildFallback(payload.expectedAmount);
    }

    try {
      return await this.analyzeWithOpenAI(payload);
    } catch (error) {
      console.error('Falha na analise IA do comprovante:', error);
      return this.buildFallback(payload.expectedAmount);
    }
  }
}

module.exports = new PaymentProofAnalysisService();
