const http = require('http');
const https = require('https');
const whiteLabelRepository = require('../repositories/white-label.repository');

const DEFAULT_BRAND_NAME = 'PulsePay';

async function resolveBrandName(adminId) {
  if (!adminId) return DEFAULT_BRAND_NAME;
  try {
    const wl = await whiteLabelRepository.findByUserId(adminId);
    const name = wl?.systemName ? String(wl.systemName).trim() : '';
    return name || DEFAULT_BRAND_NAME;
  } catch (_error) {
    return DEFAULT_BRAND_NAME;
  }
}

class ResellerWelcomeNotificationsService {
  getZapServiceUrl() {
    return process.env.GO_ZAP_SERVICE_URL || 'http://localhost:8080';
  }

  getPanelUrl() {
    return process.env.PULSEPAY_PANEL_URL || process.env.PULSEPAY_ADMIN_URL || 'https://pulsepaypainel.vercel.app/';
  }

  async makeRequest(url, { method = 'GET', payload } = {}) {
    const protocol = url.startsWith('https') ? https : http;
    const body = payload ? JSON.stringify(payload) : null;

    return new Promise((resolve, reject) => {
      const req = protocol.request(url, {
        method,
        headers: body
          ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
          }
          : undefined
      }, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            return reject(new Error(`Status ${res.statusCode}: ${responseBody}`));
          }
          resolve(responseBody);
        });
      });

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  async isZapConnected() {
    try {
      const raw = await this.makeRequest(`${this.getZapServiceUrl()}/api/status`);
      const payload = JSON.parse(raw);
      return payload?.connected === true;
    } catch (_error) {
      return false;
    }
  }

  buildMessage({ email, password, brandName }) {
    const brand = (brandName || DEFAULT_BRAND_NAME).toUpperCase();
    return [
      '*SEJA BEM VINDO A NOSSA PLATAFORMA*',
      '',
      `*Login:* ${email}`,
      `*Senha:* ${password}`,
      '',
      '*Painel de Recarga:*',
      this.getPanelUrl(),
      '',
      `*${brand}*`
    ].join('\n');
  }

  async notify({ phone, email, password, adminId }) {
    if (!phone || !email || !password) return false;
    const connected = await this.isZapConnected();
    if (!connected) return false;

    const brandName = await resolveBrandName(adminId);

    await this.makeRequest(`${this.getZapServiceUrl()}/api/send`, {
      method: 'POST',
      payload: {
        number: phone,
        message: this.buildMessage({ email, password, brandName })
      }
    });

    return true;
  }
}

module.exports = new ResellerWelcomeNotificationsService();
