const { createId } = require('../utils/id');

class ClientModel {
  constructor({
    id = createId(),
    nome,
    telefone,
    tipo,
    servidor,
    plano,
    status,
    vencimento,
    statusVencimento
  }) {
    this.id = id;
    this.nome = nome;
    this.telefone = telefone;
    this.tipo = tipo;
    this.servidor = servidor;
    this.plano = plano;
    this.status = status;
    this.vencimento = vencimento;
    this.statusVencimento = statusVencimento;
  }
}

module.exports = ClientModel;
