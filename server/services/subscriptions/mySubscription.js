const mongoose = require("mongoose");
const UserSubscription = require("../../models/UserSubscription");
const Subscription = require("../../models/Subscription");
const { SUBSCRIPTION_LIMITS, PAYMENT_LIMITS } = require("../../constants");
const { pagination } = require("../../utils");
const { getSubscriptionSettings } = require("./settings");
const { buildQuote } = require("./quote");
const {
  toPaise,
  toPlanView,
  getActivePlans,
  getOpenPeriods,
  splitPeriods,
  syncStatuses,
  toUserSubscriptionView,
} = require("./periods");

const upgradeOptionsFor = (current, periods, settings, plans, now) => {
  const currentPrice = toPaise(current.plan.price);
  return plans
    .filter((plan) => toPaise(plan.price) > currentPrice)
    .map((plan) => {
      try {
        const quote = buildQuote({ plan, periods, settings, now });
        return {
          plan: toPlanView(plan),
          planPrice: quote.planPrice,
          creditApplied: quote.creditApplied,
          payable: quote.payable,
          currency: quote.currency,
        };
      } catch (err) {
        return null;
      }
    })
    .filter(Boolean);
};

/**
 * "My plan" screen: current period, queued renewal, and what the user can
 * buy next (renew / upgrade options).
 */
exports.getMySubscription = async (userId) => {
  const now = new Date();
  await syncStatuses({ userId }, now);
  const [periods, settings] = await Promise.all([
    getOpenPeriods(userId, now),
    getSubscriptionSettings(),
  ]);
  const { current, scheduled } = splitPeriods(periods, now);

  let canRenew = false;
  let upgradeOptions = [];
  if (current) {
    const currentPlan = await Subscription.findOne({
      _id: current.planId,
      isActive: true,
      isDeleted: false,
    }).lean();
    canRenew =
      Boolean(currentPlan) &&
      toPaise(currentPlan.price) >= PAYMENT_LIMITS.MIN_AMOUNT_PAISE &&
      scheduled.length < SUBSCRIPTION_LIMITS.MAX_SCHEDULED;
    if (settings.allowUpgrade) {
      const plans = await getActivePlans();
      upgradeOptions = upgradeOptionsFor(current, periods, settings, plans, now);
    }
  }

  return {
    isSubscribed: Boolean(current),
    current: current ? toUserSubscriptionView(current, now) : null,
    scheduled: scheduled.map((p) => toUserSubscriptionView(p, now)),
    canRenew,
    upgradeEnabled: settings.allowUpgrade,
    upgradeOptions,
  };
};

exports.getMySubscriptionHistory = async (userId, query) => {
  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 10;
  const now = new Date();
  await syncStatuses({ userId }, now);
  const pipeline = [
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $sort: { createdAt: -1, _id: -1 } },
  ];
  const result = await pagination(UserSubscription, pipeline, page, limit, {
    allowEmpty: true,
  });
  result.data = result.data.map((p) => toUserSubscriptionView(p, now));
  return result;
};
