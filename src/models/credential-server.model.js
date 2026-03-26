const { createId } = require('../utils/id');

class CredentialServerModel {
  constructor({
    id = createId(),
    credentialId,
    serverId,
    priceOverride = null,
    isActive = true
  }) {
    this.id = id;
    this.credentialId = credentialId;
    this.serverId = serverId;
    this.priceOverride = priceOverride;
    this.isActive = isActive;
  }
}

module.exports = CredentialServerModel;
