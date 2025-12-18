const Subscription = require("../../models/Subscription");
const { throwError } = require("../../utils");

exports.getSubscription = async (subscriptionId) => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription || subscription.isDeleted) {
    throwError(404, "Subscription not found");
  }
  return subscription;
};
