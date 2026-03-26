const { createId } = require('../utils/id');

class RechargeRequestModel {
  constructor({
    id = createId(),
    credentialId,
    serverId,
    accountLogin,
    quantity,
    unitPrice,
    totalAmount,
    paymentMethod = 'pix',
    paymentStatus = 'pendente_pagamento',
    pixCode = null,
    pixTxid = null,
    requestedByPhone = null
  }) {
    this.id = id;
    this.credentialId = credentialId;
    this.serverId = serverId;
    this.accountLogin = accountLogin;
    this.quantity = quantity;
    this.unitPrice = unitPrice;
    this.totalAmount = totalAmount;
    this.paymentMethod = paymentMethod;
    this.paymentStatus = paymentStatus;
    this.pixCode = pixCode;
    this.pixTxid = pixTxid;
    this.requestedByPhone = requestedByPhone;
  }
}

module.exports = RechargeRequestModel;
