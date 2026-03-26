function normalizeCredentialName(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function sanitizeLast4(value) {
  return String(value || '').replace(/\D/g, '').slice(-4);
}

function buildCredentialKey(nomeNormalized, last4) {
  return `${nomeNormalized}::${last4}`;
}

module.exports = {
  normalizeCredentialName,
  sanitizeLast4,
  buildCredentialKey
};
