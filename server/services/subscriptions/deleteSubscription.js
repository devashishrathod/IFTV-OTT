const Subscription = require("../../models/Subscription");
const { throwError } = require("../../utils");

exports.deleteSubscription = async (subscriptionId) => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription || subscription.isDeleted) {
    throwError(404, "Subscription not found");
  }
  subscription.isActive = false;
  subscription.isDeleted = true;
  subscription.updatedAt = new Date();
  await subscription.save();
  return;
};
