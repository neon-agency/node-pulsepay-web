const http = require('http');
const https = require('https');

class BotIntegrationsService {
  getBotConfig() {
    return {
      phone_number_id: process.env.BOT_PHONE_NUMBER_ID || 'PENDING_ID',
      access_token: process.env.BOT_ACCESS_TOKEN || 'PENDING_TOKEN',
      pix_key: process.env.PIX_KEY || 'b0944752-7136-49ef-920a-0d21a3aa4be5',
      internal_api_key: process.env.INTERNAL_API_KEY || null
    };
  }

  getUrls() {
    const defaultVercelUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : null;

    return {
      whatsappServiceUrl: process.env.WHATSAPP_SERVICE_URL || 'http://localhost:8082',
      paymentServiceUrl: process.env.PAYMENT_SERVICE_URL || 'https://go-payment-825906875083.europe-west1.run.app',
      internalApiBaseUrl: process.env.INTERNAL_API_BASE_URL || defaultVercelUrl || `http://localhost:${process.env.API_PORT || 3001}`
    };
  }

  getGraphApiBaseUrl() {
    return process.env.WHATSAPP_GRAPH_API_URL || 'https://graph.facebook.com/v22.0';
  }

  async makeRequest(url, { method = 'POST', payload, headers = {} } = {}) {
    const hasPayload = payload !== undefined && payload !== null;
    const data = hasPayload ? JSON.stringify(payload) : null;
    const protocol = url.startsWith('https') ? https : http;

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(hasPayload ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers
      }
    };

    return new Promise((resolve, reject) => {
      const req = protocol.request(url, options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 400) {
            return reject(new Error(`Status ${res.statusCode}: ${body}`));
          }
          resolve(body);
        });
      });

      req.on('error', (error) => reject(error));
      if (data) req.write(data);
      req.end();
    });
  }

  async makeBinaryRequest(url, { method = 'GET', headers = {} } = {}) {
    const protocol = url.startsWith('https') ? https : http;

    return new Promise((resolve, reject) => {
      const req = protocol.request(url, {
        method,
        headers
      }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          if (res.statusCode >= 400) {
            return reject(new Error(`Status ${res.statusCode}: ${buffer.toString('utf8')}`));
          }

          resolve({
            buffer,
            mimeType: res.headers['content-type'] || null
          });
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  async sendWhatsAppText(to, message) {
    const { whatsappServiceUrl } = this.getUrls();
    const config = this.getBotConfig();

    await this.makeRequest(`${whatsappServiceUrl}/v1/messages/send`, {
      method: 'POST',
      payload: {
        phone_number_id: config.phone_number_id,
        access_token: config.access_token,
        to,
        type: 'text',
        message
      }
    });
  }

  async sendWhatsAppButtons(to, message, buttons) {
    const { whatsappServiceUrl } = this.getUrls();
    const config = this.getBotConfig();

    await this.makeRequest(`${whatsappServiceUrl}/v1/messages/send`, {
      method: 'POST',
      payload: {
        phone_number_id: config.phone_number_id,
        access_token: config.access_token,
        to,
        type: 'interactive',
        interactive_type: 'button',
        message,
        buttons: buttons.map((item) => ({ id: item.id, title: item.title }))
      }
    });
  }

  async sendWhatsAppList(to, message, buttonText, rows) {
    const { whatsappServiceUrl } = this.getUrls();
    const config = this.getBotConfig();

    await this.makeRequest(`${whatsappServiceUrl}/v1/messages/send`, {
      method: 'POST',
      payload: {
        phone_number_id: config.phone_number_id,
        access_token: config.access_token,
        to,
        type: 'interactive',
        interactive_type: 'list',
        message,
        list_button: buttonText,
        list_sections: [
          {
            title: 'Servidores',
            rows: rows.map((row) => ({
              id: row.id,
              title: row.title,
              description: row.description || ''
            }))
          }
        ]
      }
    });
  }

  async callPaymentApi(payload) {
    const { paymentServiceUrl } = this.getUrls();
    const body = await this.makeRequest(`${paymentServiceUrl}/api/v1/payments`, {
      method: 'POST',
      payload
    });

    try {
      return JSON.parse(body);
    } catch (_error) {
      throw new Error(`Erro ao processar resposta do serviço de pagamento: ${body}`);
    }
  }

  async getPaymentStatus({ provider, id }) {
    const { paymentServiceUrl } = this.getUrls();
    const body = await this.makeRequest(`${paymentServiceUrl}/api/v1/payments/${provider}/${id}`, {
      method: 'GET'
    });

    try {
      return JSON.parse(body);
    } catch (_error) {
      throw new Error(`Resposta inválida ao consultar pagamento: ${body}`);
    }
  }

  async fetchServersFromApi() {
    const { internalApiBaseUrl } = this.getUrls();
    const parseServersResponse = (body) => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch (_error) {
        throw new Error(`Resposta inválida ao consultar servidores: ${body}`);
      }

      if (!Array.isArray(parsed)) {
        throw new Error('A API de servidores retornou um formato inesperado');
      }

      return parsed;
    };

    const body = await this.makeRequest(`${internalApiBaseUrl}/api/servers`, {
      method: 'GET'
    });
    return parseServersResponse(body);
  }

  getInternalApiHeaders() {
    const { internal_api_key: internalApiKey } = this.getBotConfig();
    if (!internalApiKey) return {};

    return {
      'x-internal-api-key': internalApiKey
    };
  }

  async resolveCredentialFromApi({ nome, last4 }) {
    const { internalApiBaseUrl } = this.getUrls();
    const body = await this.makeRequest(`${internalApiBaseUrl}/api/bot/resolve-credential`, {
      method: 'POST',
      payload: { nome, last4 },
      headers: this.getInternalApiHeaders()
    });

    try {
      return JSON.parse(body);
    } catch (_error) {
      throw new Error(`Resposta inválida ao resolver credencial: ${body}`);
    }
  }

  async createRechargeRequest(payload) {
    const { internalApiBaseUrl } = this.getUrls();
    const body = await this.makeRequest(`${internalApiBaseUrl}/api/recharge-requests`, {
      method: 'POST',
      payload,
      headers: this.getInternalApiHeaders()
    });

    try {
      return JSON.parse(body);
    } catch (_error) {
      throw new Error(`Resposta inválida ao criar recarga: ${body}`);
    }
  }

  async updateRechargeRequestPayment(id, payload) {
    const { internalApiBaseUrl } = this.getUrls();
    const body = await this.makeRequest(`${internalApiBaseUrl}/api/recharge-requests/${id}/payment`, {
      method: 'PATCH',
      payload,
      headers: this.getInternalApiHeaders()
    });

    try {
      return JSON.parse(body);
    } catch (_error) {
      throw new Error(`Resposta inválida ao atualizar pagamento: ${body}`);
    }
  }

  async fetchWhatsAppMediaInfo(mediaId) {
    const config = this.getBotConfig();
    const body = await this.makeRequest(`${this.getGraphApiBaseUrl()}/${mediaId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.access_token}`
      }
    });

    try {
      return JSON.parse(body);
    } catch (_error) {
      throw new Error(`Resposta invalida ao consultar midia do WhatsApp: ${body}`);
    }
  }

  async downloadWhatsAppMedia(mediaId) {
    const config = this.getBotConfig();
    const info = await this.fetchWhatsAppMediaInfo(mediaId);
    if (!info?.url) {
      throw new Error('A API da Meta nao retornou URL da midia');
    }

    const file = await this.makeBinaryRequest(info.url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.access_token}`
      }
    });

    return {
      ...file,
      fileName: info?.file_name || null,
      meta: info
    };
  }
}

module.exports = new BotIntegrationsService();
