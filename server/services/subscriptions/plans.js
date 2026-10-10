const Subscription = require("../../models/Subscription");
const { throwError, validateObjectId } = require("../../utils");
const { getActivePlans, toPlanView } = require("./periods");

/**
 * Public plan list for web / app: active plans only, in display order.
 * An empty list is a normal answer, not a 404.
 */
exports.getPlans = async () => {
  const plans = await getActivePlans();
  return plans.map(toPlanView);
};

exports.getPlan = async (planId) => {
  validateObjectId(planId, "plan Id");
  const plan = await Subscription.findOne({
    _id: planId,
    isActive: true,
    isDeleted: false,
  }).lean();
  if (!plan) throwError(404, "Plan not found");
  return toPlanView(plan);
};
