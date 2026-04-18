const { createId } = require('../utils/id');

class ServerModel {
  constructor({ id = createId(), servidor, url, basePrice = 10, priceTiers = [] }) {
    this.id = id;
    this.servidor = servidor;
    this.url = url;
    this.basePrice = basePrice;
    this.priceTiers = priceTiers;
  }
}

module.exports = ServerModel;
