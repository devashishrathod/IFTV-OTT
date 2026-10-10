const { asyncWrapper, sendSuccess } = require("../../utils");
const { getPlans, getPlan } = require("../../services/subscriptions");

exports.plans = asyncWrapper(async (req, res) => {
  const result = await getPlans();
  return sendSuccess(res, 200, "Plans fetched", result);
});

exports.plan = asyncWrapper(async (req, res) => {
  const result = await getPlan(req.params?.id);
  return sendSuccess(res, 200, "Plan fetched", result);
});
