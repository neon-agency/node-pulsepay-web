const { createId } = require('../utils/id');

class CredentialServerModel {
  constructor({
    id = createId(),
    credentialId,
    serverId,
    priceOverride = null,
    priceTiersOverride = [],
    isActive = true,
    email = null,
    login = null
  }) {
    this.id = id;
    this.credentialId = credentialId;
    this.serverId = serverId;
    this.priceOverride = priceOverride;
    this.priceTiersOverride = priceTiersOverride;
    this.isActive = isActive;
    this.email = email;
    this.login = login;
  }
}

module.exports = CredentialServerModel;
