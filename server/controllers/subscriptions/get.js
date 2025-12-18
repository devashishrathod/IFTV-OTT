const { asyncWrapper, sendSuccess } = require("../../utils");
const { getSubscription } = require("../../services/subscriptions");

exports.get = asyncWrapper(async (req, res) => {
  const subscriptionId = req.params?.id;
  const result = await getSubscription(subscriptionId);
  return sendSuccess(res, 200, "Subscription fetched", result);
});
