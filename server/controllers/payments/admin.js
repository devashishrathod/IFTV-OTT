const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const {
  validateAdminPaymentsQuery,
  validateStatsQuery,
} = require("../../validator/payments");
const {
  adminGetAllPayments,
  adminGetPayment,
  adminSyncPayment,
  adminPaymentStats,
} = require("../../services/payments");

exports.adminGetAll = asyncWrapper(async (req, res) => {
  const { error, value } = validateAdminPaymentsQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await adminGetAllPayments(value);
  return sendSuccess(res, 200, "Payments fetched", result);
});

exports.adminGet = asyncWrapper(async (req, res) => {
  const result = await adminGetPayment(req.params?.id);
  return sendSuccess(res, 200, "Payment fetched", result);
});

exports.adminSync = asyncWrapper(async (req, res) => {
  const result = await adminSyncPayment(req.params?.id);
  return sendSuccess(res, 200, "Payment synced with Razorpay", result);
});

exports.adminStats = asyncWrapper(async (req, res) => {
  const { error, value } = validateStatsQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await adminPaymentStats(value);
  return sendSuccess(res, 200, "Payment stats fetched", result);
});
