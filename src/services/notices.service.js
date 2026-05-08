const AppError = require('../errors/app-error');
const NoticeModel = require('../models/notice.model');
const noticesRepository = require('../repositories/notices.repository');

const BANNER_ALLOWED_MIME = {
  'image/png': true,
  'image/jpeg': true,
  'image/jpg': true,
  'image/webp': true,
  'image/gif': true,
  'image/svg+xml': true
};
const BANNER_MAX_BYTES = 4 * 1024 * 1024;

class NoticesService {
  parseDate(value, field) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new AppError(`Campo "${field}" deve ser uma data válida`, 400);
    }
    return date.toISOString();
  }

  validateBannerUrl(value) {
    if (value === undefined || value === null || value === '') return null;
    const str = String(value).trim();
    if (!str) return null;
    if (str.startsWith('data:')) return str;
    try {
      const u = new URL(str);
      if (!['http:', 'https:'].includes(u.protocol)) {
        throw new AppError('Banner deve ser uma URL http(s) ou imagem enviada', 400);
      }
      return u.toString();
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('Banner deve ser uma URL válida ou imagem enviada', 400);
    }
  }

  normalizeWindow({ startsAt, endsAt }) {
    if (startsAt && endsAt) {
      if (new Date(startsAt).getTime() > new Date(endsAt).getTime()) {
        throw new AppError('"startsAt" não pode ser maior que "endsAt"', 400);
      }
    }
  }

  async list() {
    return noticesRepository.findAll();
  }

  async listActive() {
    return noticesRepository.findActiveAtNow();
  }

  async getById(id) {
    const item = await noticesRepository.findById(id);
    if (!item) throw new AppError('Aviso não encontrado', 404);
    return item;
  }

  async create(payload, currentUser = null) {
    const title = String(payload?.title || '').trim();
    if (!title) throw new AppError('Campo "title" é obrigatório', 400);

    const text = String(payload?.text ?? '').trim();
    const bannerUrl = this.validateBannerUrl(payload?.bannerUrl);
    const startsAt = this.parseDate(payload?.startsAt, 'startsAt') ?? null;
    const endsAt = this.parseDate(payload?.endsAt, 'endsAt') ?? null;
    this.normalizeWindow({ startsAt, endsAt });
    const isActive = payload?.isActive === undefined ? true : Boolean(payload.isActive);

    const item = new NoticeModel({
      title,
      text,
      bannerUrl,
      isActive,
      startsAt,
      endsAt,
      createdByUserId: currentUser?.id || null
    });
    return noticesRepository.create(item);
  }

  async update(id, payload) {
    await this.getById(id);

    const updates = {};
    if (payload?.title !== undefined) {
      const t = String(payload.title).trim();
      if (!t) throw new AppError('Campo "title" não pode ser vazio', 400);
      updates.title = t;
    }
    if (payload?.text !== undefined) updates.text = String(payload.text ?? '').trim();
    if (payload?.bannerUrl !== undefined) updates.bannerUrl = this.validateBannerUrl(payload.bannerUrl);
    if (payload?.isActive !== undefined) updates.isActive = Boolean(payload.isActive);
    if (payload?.startsAt !== undefined) updates.startsAt = this.parseDate(payload.startsAt, 'startsAt');
    if (payload?.endsAt !== undefined) updates.endsAt = this.parseDate(payload.endsAt, 'endsAt');

    this.normalizeWindow({
      startsAt: updates.startsAt ?? null,
      endsAt: updates.endsAt ?? null
    });

    return noticesRepository.update(id, updates);
  }

  async remove(id) {
    await this.getById(id);
    await noticesRepository.remove(id);
  }

  async uploadBanner({ mimeType, contentBase64 }) {
    if (!contentBase64) throw new AppError('Arquivo do banner não informado', 400);

    const normalizedMime = String(mimeType || '').trim().toLowerCase();
    if (!BANNER_ALLOWED_MIME[normalizedMime]) {
      throw new AppError('Formato inválido. Envie PNG, JPG, WEBP, GIF ou SVG.', 400);
    }

    const buffer = Buffer.from(String(contentBase64), 'base64');
    if (!buffer.length) throw new AppError('Arquivo do banner inválido', 400);
    if (buffer.length > BANNER_MAX_BYTES) {
      throw new AppError('Imagem muito grande. Limite de 4 MB.', 400);
    }

    const cleanBase64 = buffer.toString('base64');
    return { bannerUrl: `data:${normalizedMime};base64,${cleanBase64}` };
  }
}

module.exports = new NoticesService();
