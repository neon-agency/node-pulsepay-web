const AppError = require('../errors/app-error');
const userPreferencesRepository = require('../repositories/user-preferences.repository');
const usersRepository = require('../repositories/users.repository');
const { createId } = require('../utils/id');

const VALID_THEMES = ['light', 'dark', 'system'];
const VALID_SCHEMES = ['default', 'blue', 'purple', 'emerald', 'orange', 'rose', 'cyan', 'amber', 'teal', 'indigo', 'lime', 'slate', 'custom'];
const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

class UserPreferencesService {
  async getForUser(userId) {
    const prefs = await userPreferencesRepository.findByUserId(userId);
    return prefs ?? { theme: 'system', colorScheme: null, customColor: null };
  }

  async upsert(userId, { theme, colorScheme, customColor }) {
    const user = await usersRepository.findById(userId);
    if (!user || !user.isActive) throw new AppError('Usuário não encontrado', 404);

    if (theme !== undefined && !VALID_THEMES.includes(theme)) {
      throw new AppError(`Tema inválido. Use: ${VALID_THEMES.join(', ')}`, 400);
    }

    if (colorScheme !== undefined && colorScheme !== null && !VALID_SCHEMES.includes(colorScheme)) {
      throw new AppError(`Esquema de cor inválido. Use: ${VALID_SCHEMES.join(', ')}`, 400);
    }

    let normalizedCustomColor = customColor;
    if (customColor !== undefined && customColor !== null && customColor !== '') {
      const stripped = String(customColor).trim();
      if (!HEX_RE.test(stripped)) {
        throw new AppError('Cor customizada deve ser um hex de 6 dígitos (ex: #f97316)', 400);
      }
      normalizedCustomColor = stripped.startsWith('#') ? stripped.toLowerCase() : `#${stripped.toLowerCase()}`;
    } else if (customColor === '' || customColor === null) {
      normalizedCustomColor = null;
    }

    return userPreferencesRepository.upsert(userId, createId(), {
      theme,
      colorScheme,
      customColor: customColor === undefined ? undefined : normalizedCustomColor,
    });
  }
}

module.exports = new UserPreferencesService();
