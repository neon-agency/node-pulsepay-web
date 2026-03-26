const { createId } = require('../utils/id');

class CredentialModel {
  constructor({
    id = createId(),
    nome,
    last4,
    nomeNormalized,
    credentialKey
  }) {
    this.id = id;
    this.nome = nome;
    this.last4 = last4;
    this.nomeNormalized = nomeNormalized;
    this.credentialKey = credentialKey;
  }
}

module.exports = CredentialModel;
