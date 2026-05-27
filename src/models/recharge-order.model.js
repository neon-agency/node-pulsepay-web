const { createId } = require('../utils/id');

class RechargeOrderModel {
  constructor({
    id = createId(),
    createdByUserId = null,
    clientId = null,
    paymentMethod = 'pix',
    paymentStatus = 'pendente_pagamento',
    totalAmount,
    itemCount,
    pixCode = null,
    pixTxid = null,
    pixKeyId = null,
    requestedByPhone = null
  }) {
    this.id = id;
    this.createdByUserId = createdByUserId;
    this.clientId = clientId;
    this.paymentMethod = paymentMethod;
    this.paymentStatus = paymentStatus;
    this.totalAmount = totalAmount;
    this.itemCount = itemCount;
    this.pixCode = pixCode;
    this.pixTxid = pixTxid;
    this.pixKeyId = pixKeyId;
    this.requestedByPhone = requestedByPhone;
  }
}

module.exports = RechargeOrderModel;
