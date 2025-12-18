const { asyncWrapper, sendSuccess } = require("../../utils");
const { deleteSubscription } = require("../../services/subscriptions");

exports.deleteSubscription = asyncWrapper(async (req, res) => {
  const subscriptionId = req.params?.id;
  await deleteSubscription(subscriptionId);
  return sendSuccess(res, 200, "Subscription deleted");
});
