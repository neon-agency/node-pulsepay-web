function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

/** Normaliza para comparar MSISDN BR (remove 55 inicial quando aplicável). */
function normalizeBrMsisdn(value) {
  let d = digitsOnly(value);
  if (d.startsWith('55') && d.length >= 12) {
    d = d.slice(2);
  }
  return d;
}

function sanitizeTelefone(value) {
  const d = digitsOnly(value);
  return d;
}

function isValidTelefone(digits) {
  return digits.length >= 10 && digits.length <= 15;
}

module.exports = {
  digitsOnly,
  normalizeBrMsisdn,
  sanitizeTelefone,
  isValidTelefone
};
