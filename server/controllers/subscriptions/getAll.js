const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const {
  validateGetAllSubscriptionQueries,
} = require("../../validator/subscriptions");
const { getAllSubscription } = require("../../services/subscriptions");

exports.getAll = asyncWrapper(async (req, res) => {
  const { error, value } = validateGetAllSubscriptionQueries(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await getAllSubscription(value);
  return sendSuccess(res, 200, "Subscriptions fetched", result);
});
