const { createId } = require('../utils/id');

class ServerModel {
  constructor({ id = createId(), servidor }) {
    this.id = id;
    this.servidor = servidor;
  }
}

module.exports = ServerModel;
