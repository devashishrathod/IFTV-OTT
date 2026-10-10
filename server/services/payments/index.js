const {
  getQuote,
  createOrder,
  verifyPayment,
  markPaymentFailed,
} = require("./checkout");
const { handleWebhook } = require("./webhook");
const { getMyPayments, getMyPayment } = require("./myPayments");
const {
  adminGetAllPayments,
  adminGetPayment,
  adminSyncPayment,
  adminPaymentStats,
} = require("./adminPayments");
const { activatePayment } = require("./activatePayment");

module.exports = {
  getQuote,
  createOrder,
  verifyPayment,
  markPaymentFailed,
  handleWebhook,
  getMyPayments,
  getMyPayment,
  adminGetAllPayments,
  adminGetPayment,
  adminSyncPayment,
  adminPaymentStats,
  activatePayment,
};
