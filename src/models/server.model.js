const { createId } = require('../utils/id');

class ServerModel {
  constructor({ id = createId(), servidor, basePrice = 10 }) {
    this.id = id;
    this.servidor = servidor;
    this.basePrice = basePrice;
  }
}

module.exports = ServerModel;
