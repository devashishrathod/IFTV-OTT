const Subscription = require("../../models/Subscription");
const { throwError, validateObjectId } = require("../../utils");

// Users who already hold this plan keep it until their period ends.
exports.deleteSubscription = async (subscriptionId) => {
  validateObjectId(subscriptionId, "Subscription Id");
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
