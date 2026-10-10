const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { validateUpdateSubscription } = require("../../validator/subscriptions");
const { updateSubscription } = require("../../services/subscriptions");

exports.updateSubscription = asyncWrapper(async (req, res) => {
  const { error, value } = validateUpdateSubscription(req.body || {});
  if (error) throwError(422, cleanJoiError(error));
  const result = await updateSubscription(req.params?.id, value);
  return sendSuccess(res, 200, "Subscription updated", result);
});
