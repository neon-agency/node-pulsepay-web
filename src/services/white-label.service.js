const AppError = require('../errors/app-error');
const whiteLabelRepository = require('../repositories/white-label.repository');
const usersRepository = require('../repositories/users.repository');
const { createId } = require('../utils/id');

const VALID_SCHEMES = ['default', 'blue', 'purple', 'emerald', 'orange', 'rose', 'cyan', 'amber', 'custom'];
const VALID_FONTS = ['default', 'inter', 'manrope', 'space-grotesk', 'poppins', 'dm-sans', 'roboto'];
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

    return whiteLabelRepository.findByUserId(adminId);
  }

  async upsert(userId, { systemName, logoUrl, colorScheme, fontFamily, customColor, domain }) {
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

    return whiteLabelRepository.upsert(userId, createId(), {
      systemName,
      logoUrl,
      colorScheme,
      fontFamily,
      customColor: customColor === undefined ? undefined : normalizedCustomColor,
      domain: domain === undefined ? undefined : normalizedDomain,
    });
  }
}

module.exports = new WhiteLabelService();
