const Subscription = require("../../models/Subscription");
const { throwError, validateObjectId } = require("../../utils");

exports.getSubscription = async (subscriptionId) => {
  validateObjectId(subscriptionId, "Subscription Id");
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription || subscription.isDeleted) {
    throwError(404, "Subscription not found");
  }
  return subscription;
};
