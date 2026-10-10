const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const {
  validateQuote,
  validateCreateOrder,
  validateVerifyPayment,
  validatePaymentFailed,
} = require("../../validator/payments");
const {
  getQuote,
  createOrder,
  verifyPayment,
  markPaymentFailed,
} = require("../../services/payments");

exports.quote = asyncWrapper(async (req, res) => {
  const { error, value } = validateQuote(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await getQuote(req.userId, value);
  return sendSuccess(res, 200, "Quote fetched", result);
});

exports.createOrder = asyncWrapper(async (req, res) => {
  const { error, value } = validateCreateOrder(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const result = await createOrder(req.user, value);
  return sendSuccess(res, 201, "Order created", result);
});

exports.verify = asyncWrapper(async (req, res) => {
  const { error, value } = validateVerifyPayment(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const result = await verifyPayment(req.user, value);
  return sendSuccess(res, 200, "Payment verified, plan activated", result);
});

exports.failed = asyncWrapper(async (req, res) => {
  const { error, value } = validatePaymentFailed(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const result = await markPaymentFailed(req.user, value);
  return sendSuccess(res, 200, "Payment status saved", result);
});
