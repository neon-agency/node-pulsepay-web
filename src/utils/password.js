const crypto = require('crypto');

const SCRYPT_KEYLEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, originalHash] = String(storedHash || '').split(':');
  if (!salt || !originalHash) {
    return false;
  }

  const derived = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
  const originalBuffer = Buffer.from(originalHash, 'hex');
  const derivedBuffer = Buffer.from(derived, 'hex');

  return (
    originalBuffer.length === derivedBuffer.length &&
    crypto.timingSafeEqual(originalBuffer, derivedBuffer)
  );
}

module.exports = {
  hashPassword,
  verifyPassword
};
