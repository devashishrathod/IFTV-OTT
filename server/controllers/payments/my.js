const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { validateMyPaymentsQuery } = require("../../validator/payments");
const { getMyPayments, getMyPayment } = require("../../services/payments");

exports.getMy = asyncWrapper(async (req, res) => {
  const { error, value } = validateMyPaymentsQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await getMyPayments(req.userId, value);
  return sendSuccess(res, 200, "Payments fetched", result);
});

exports.getMyOne = asyncWrapper(async (req, res) => {
  const result = await getMyPayment(req.userId, req.params?.id);
  return sendSuccess(res, 200, "Payment fetched", result);
});
