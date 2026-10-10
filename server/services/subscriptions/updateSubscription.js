const Subscription = require("../../models/Subscription");
const { DURATION_MAP } = require("../../constants");
const { throwError, validateObjectId } = require("../../utils");

/**
 * Price / name changes apply to new purchases only: every purchase keeps a
 * snapshot of the plan as it was when bought.
 */
exports.updateSubscription = async (subscriptionId, payload) => {
  validateObjectId(subscriptionId, "Subscription Id");
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription || subscription.isDeleted) {
    throwError(404, "Subscription not found");
  }
  const name = payload.name ?? subscription.name;
  const type = payload.type ?? subscription.type;
  if (payload.name !== undefined || payload.type !== undefined) {
    const existing = await Subscription.findOne({
      _id: { $ne: subscription._id },
      name,
      type,
      isDeleted: false,
    });
    if (existing) {
      throwError(409, `Subscription with this name for ${type} plan already exists`);
    }
  }
  if (payload.type) payload.durationInDays = DURATION_MAP[payload.type];
  Object.assign(subscription, payload);
  await subscription.save();
  return subscription;
};
