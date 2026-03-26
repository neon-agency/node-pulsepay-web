const { randomUUID } = require('crypto');

function createId() {
  if (typeof randomUUID === 'function') {
    return randomUUID();
  }

  return `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

module.exports = { createId };
