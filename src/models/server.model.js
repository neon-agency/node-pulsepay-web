const { createId } = require('../utils/id');

class ServerModel {
  constructor({ id = createId(), servidor, url, basePrice = 10, priceTiers = [], custoCredito = 0, estoque = 0, estoqueAlerta = null }) {
    this.id = id;
    this.servidor = servidor;
    this.url = url;
    this.basePrice = basePrice;
    this.priceTiers = priceTiers;
    this.custoCredito = custoCredito;
    this.estoque = estoque;
    this.estoqueAlerta = estoqueAlerta;
  }
}

module.exports = ServerModel;
