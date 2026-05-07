const AppError = require('../errors/app-error');
const fs = require('fs/promises');
const path = require('path');
const whiteLabelRepository = require('../repositories/white-label.repository');
const usersRepository = require('../repositories/users.repository');
const { createId } = require('../utils/id');

const LOGO_ALLOWED_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

const VALID_SCHEMES = ['default', 'blue', 'purple', 'emerald', 'orange', 'rose', 'cyan', 'amber', 'teal', 'indigo', 'lime', 'slate', 'custom'];
const VALID_FONTS = ['default', 'inter', 'manrope', 'space-grotesk', 'poppins', 'dm-sans', 'roboto'];
const VALID_LOGIN_LAYOUTS = ['split-left', 'split-right', 'centered'];
const HEX_RE = /^#?[0-9a-fA-F]{6}$/;
// hostname válido (RFC 1123 simplificado): labels alfanuméricos com hífen, separados por ponto
const DOMAIN_RE = /^(?!-)(?:[a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,}$/;

class WhiteLabelService {
  async getByDomain(domain) {
    if (!domain) return null;
    return whiteLabelRepository.findByDomain(domain);
  }

  async getForUser(userId) {
    const user = await usersRepository.findById(userId);
    if (!user || !user.isActive) throw new AppError('Usuário não encontrado', 404);

    let adminId = user.role === 'reseller' ? user.adminId : userId;

    // Fallback: reseller sem admin_id (criado antes da migration) → primeiro admin do sistema
    if (user.role === 'reseller' && !adminId) {
      const firstAdmin = await usersRepository.findFirstAdmin();
      adminId = firstAdmin?.id ?? null;
    }

    if (!adminId) return null;

    const config = await whiteLabelRepository.findByUserId(adminId);
    const adminUser = await usersRepository.findById(adminId);
    const adminWhatsappPhone = adminUser?.whatsappPhone || null;

    if (!config) {
      return adminWhatsappPhone ? { adminWhatsappPhone } : null;
    }

    return { ...config, adminWhatsappPhone };
  }

  async upsert(userId, {
    systemName, logoUrl, colorScheme, fontFamily, customColor, domain,
    loginLayout, loginTitle, loginSubtitle, loginTagline, loginFeatures,
  }) {
    const user = await usersRepository.findById(userId);
    if (!user || !user.isActive) throw new AppError('Usuário não encontrado', 404);
    if (user.role !== 'admin') throw new AppError('Somente administradores podem configurar o white label', 403);

    if (colorScheme && !VALID_SCHEMES.includes(colorScheme)) {
      throw new AppError(`Esquema de cor inválido. Use: ${VALID_SCHEMES.join(', ')}`, 400);
    }

    if (fontFamily && !VALID_FONTS.includes(fontFamily)) {
      throw new AppError(`Fonte inválida. Use: ${VALID_FONTS.join(', ')}`, 400);
    }

    let normalizedCustomColor = customColor;
    if (customColor) {
      const stripped = String(customColor).trim();
      if (!HEX_RE.test(stripped)) {
        throw new AppError('Cor customizada deve ser um hex de 6 dígitos (ex: #f97316)', 400);
      }
      normalizedCustomColor = stripped.startsWith('#') ? stripped.toLowerCase() : `#${stripped.toLowerCase()}`;
    }

    if (systemName !== undefined) {
      const trimmed = String(systemName ?? '').trim();
      if (trimmed && trimmed.length > 160) throw new AppError('Nome do sistema muito longo (máx. 160 chars)', 400);
    }

    let normalizedDomain = domain;
    if (domain !== undefined) {
      const stripped = String(domain ?? '').trim().toLowerCase();
      if (stripped) {
        if (!DOMAIN_RE.test(stripped)) {
          throw new AppError('Domínio inválido. Use formato como pay.suamarca.com', 400);
        }
        // bloqueia colidir com domínio de outro usuário
        const conflict = await whiteLabelRepository.findByDomain(stripped);
        if (conflict && conflict.userId !== userId) {
          throw new AppError('Este domínio já está em uso por outro gestor', 409);
        }
        normalizedDomain = stripped;
      } else {
        normalizedDomain = null;
      }
    }

    if (loginLayout && !VALID_LOGIN_LAYOUTS.includes(loginLayout)) {
      throw new AppError(`Layout de login inválido. Use: ${VALID_LOGIN_LAYOUTS.join(', ')}`, 400);
    }

    let normalizedFeatures = loginFeatures;
    if (loginFeatures !== undefined) {
      if (loginFeatures === null || (Array.isArray(loginFeatures) && loginFeatures.length === 0)) {
        normalizedFeatures = null;
      } else if (!Array.isArray(loginFeatures)) {
        throw new AppError('login_features deve ser um array', 400);
      } else {
        normalizedFeatures = loginFeatures
          .map((f) => String(f ?? '').trim())
          .filter(Boolean)
          .slice(0, 5);
      }
    }

    return whiteLabelRepository.upsert(userId, createId(), {
      systemName,
      logoUrl,
      colorScheme,
      fontFamily,
      customColor: customColor === undefined ? undefined : normalizedCustomColor,
      domain: domain === undefined ? undefined : normalizedDomain,
      loginLayout,
      loginTitle,
      loginSubtitle,
      loginTagline,
      loginFeatures: normalizedFeatures,
    });
  }

  async uploadLogo(userId, { fileName, mimeType, contentBase64, publicBaseUrl }) {
    const user = await usersRepository.findById(userId);
    if (!user || !user.isActive) throw new AppError('Usuário não encontrado', 404);
    if (user.role !== 'admin') throw new AppError('Somente administradores podem enviar a logo', 403);

    if (!contentBase64) throw new AppError('Arquivo da logo não informado', 400);

    const normalizedMime = String(mimeType || '').trim().toLowerCase();
    const ext = LOGO_ALLOWED_MIME[normalizedMime];
    if (!ext) {
      throw new AppError('Formato inválido. Envie PNG, JPG, WEBP ou SVG.', 400);
    }

    const buffer = Buffer.from(String(contentBase64), 'base64');
    if (!buffer.length) throw new AppError('Arquivo da logo inválido', 400);
    if (buffer.length > LOGO_MAX_BYTES) {
      throw new AppError('Imagem muito grande. Limite de 2 MB.', 400);
    }

    const logoId = createId();
    const relativeDir = path.join('storage', 'logos', userId);
    const absoluteDir = path.resolve(process.cwd(), relativeDir);
    await fs.mkdir(absoluteDir, { recursive: true });
    const absolutePath = path.join(absoluteDir, `${logoId}${ext}`);
    await fs.writeFile(absolutePath, buffer);

    const relativeUrl = `/storage/logos/${userId}/${logoId}${ext}`;
    const base = (publicBaseUrl || process.env.PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
    const logoUrl = base ? `${base}${relativeUrl}` : relativeUrl;
    await whiteLabelRepository.upsert(userId, createId(), { logoUrl });
    return { logoUrl };
  }
}

module.exports = new WhiteLabelService();
