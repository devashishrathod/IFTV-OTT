const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { validateHistoryQuery } = require("../../validator/subscriptions");
const {
  getMySubscription,
  getMySubscriptionHistory,
} = require("../../services/subscriptions");

exports.my = asyncWrapper(async (req, res) => {
  const result = await getMySubscription(req.userId);
  return sendSuccess(res, 200, "Subscription fetched", result);
});

exports.myHistory = asyncWrapper(async (req, res) => {
  const { error, value } = validateHistoryQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await getMySubscriptionHistory(req.userId, value);
  return sendSuccess(res, 200, "Subscription history fetched", result);
});
