const { createId } = require('../utils/id');

class RechargeOrderModel {
  constructor({
    id = createId(),
    createdByUserId = null,
    clientId = null,
    paymentMethod = 'pix',
    status = 'SOLICITADO',
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
    this.status = status;
    this.totalAmount = totalAmount;
    this.itemCount = itemCount;
    this.pixCode = pixCode;
    this.pixTxid = pixTxid;
    this.pixKeyId = pixKeyId;
    this.requestedByPhone = requestedByPhone;
  }
}

module.exports = RechargeOrderModel;
