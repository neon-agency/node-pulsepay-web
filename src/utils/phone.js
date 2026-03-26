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

/** Variações comuns do mesmo número BR (WhatsApp costuma vir com 9 após DDD; cadastros antigos às vezes sem). */
function brLocalMsisdnVariants(normalizedLocal) {
  const d = String(normalizedLocal || '');
  const variants = new Set();
  if (d.length >= 10) variants.add(d);
  if (d.length === 11 && d.charAt(2) === '9') {
    variants.add(d.slice(0, 2) + d.slice(3));
  }
  if (d.length === 10 && /^\d{10}$/.test(d)) {
    variants.add(d.slice(0, 2) + '9' + d.slice(2));
  }
  return variants;
}

function msisdnBrMatchSet(rawDigits) {
  const base = normalizeBrMsisdn(rawDigits);
  const set = new Set();
  for (const v of brLocalMsisdnVariants(base)) {
    if (v.length >= 10 && v.length <= 11) set.add(v);
  }
  return set;
}

function msisdnBrMatches(aDigits, bDigits) {
  const a = msisdnBrMatchSet(aDigits);
  const b = msisdnBrMatchSet(bDigits);
  if (!a.size || !b.size) return false;
  for (const x of a) {
    if (b.has(x)) return true;
  }
  return false;
}

module.exports = {
  digitsOnly,
  normalizeBrMsisdn,
  sanitizeTelefone,
  isValidTelefone,
  brLocalMsisdnVariants,
  msisdnBrMatchSet,
  msisdnBrMatches
};
