const User = require("../../models/User");
const UserSubscription = require("../../models/UserSubscription");
const { ROLES, LOGIN_TYPES } = require("../../constants");
const { ENTITLED_STATUSES } = require("../subscriptions/periods");
const { inRange, bucketKey } = require("./dateRange");
const { toCircle, toKpi, first } = require("./helpers");

// Customers only: admin and staff accounts are not counted
exports.USER_MATCH = Object.freeze({ role: ROLES.USER, isDeleted: false });

const isActive = { $ne: ["$isActive", false] };
const isTrue = (field) => ({ $cond: [{ $eq: [field, true] }, 1, 0] });

const verificationOf = {
  $switch: {
    branches: [
      {
        case: { $and: [{ $eq: ["$isEmailVerified", true] }, { $eq: ["$isMobileVerified", true] }] },
        then: "both",
      },
      { case: { $eq: ["$isEmailVerified", true] }, then: "email_only" },
      { case: { $eq: ["$isMobileVerified", true] }, then: "mobile_only" },
    ],
    default: "none",
  },
};

/**
 * Signups (date range) and the user base today. Users have no platform, so
 * platform / plan filters don't apply here.
 */
exports.usersSection = async ({ period, now }) => {
  const { current, previous, groupBy } = period;
  const inCurrent = { $match: { createdAt: inRange(current) } };
  const facet = {
    totals: [
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [isActive, 1, 0] } },
          emailVerified: { $sum: isTrue("$isEmailVerified") },
          mobileVerified: { $sum: isTrue("$isMobileVerified") },
          signUpCompleted: { $sum: isTrue("$isSignUpCompleted") },
          onlineNow: { $sum: isTrue("$isOnline") },
        },
      },
    ],
    byLoginType: [
      inCurrent,
      { $group: { _id: { $ifNull: ["$loginType", LOGIN_TYPES.PASSWORD] }, count: { $sum: 1 } } },
    ],
    byStatus: [
      inCurrent,
      { $group: { _id: { $cond: [isActive, "active", "inactive"] }, count: { $sum: 1 } } },
    ],
    byVerification: [inCurrent, { $group: { _id: verificationOf, count: { $sum: 1 } } }],
    trend: [
      inCurrent,
      { $group: { _id: bucketKey("$createdAt", groupBy), count: { $sum: 1 } } },
    ],
  };
  if (previous) {
    facet.previous = [{ $match: { createdAt: inRange(previous) } }, { $count: "count" }];
  }

  const [[result], subscribedIds, everSubscribedIds] = await Promise.all([
    User.aggregate([{ $match: exports.USER_MATCH }, { $facet: facet }]),
    UserSubscription.distinct("userId", {
      status: { $in: ENTITLED_STATUSES },
      startDate: { $lte: now },
      endDate: { $gt: now },
    }),
    UserSubscription.distinct("userId"),
  ]);
  const countCustomers = (ids) =>
    ids.length ? User.countDocuments({ ...exports.USER_MATCH, _id: { $in: ids } }) : 0;
  const [subscribed, everSubscribed] = await Promise.all([
    countCustomers(subscribedIds),
    countCustomers(everSubscribedIds),
  ]);

  const totals = first(result.totals);
  const total = totals.total || 0;
  const byStatus = toCircle(result.byStatus, { keys: ["active", "inactive"] });
  const newUsers = byStatus.total;

  return {
    kpis: {
      newUsers: toKpi(newUsers, previous ? first(result.previous).count || 0 : null),
      totalUsers: total,
    },
    section: {
      total,
      active: totals.active || 0,
      inactive: total - (totals.active || 0),
      emailVerified: totals.emailVerified || 0,
      mobileVerified: totals.mobileVerified || 0,
      signUpCompleted: totals.signUpCompleted || 0,
      onlineNow: totals.onlineNow || 0,
      newInRange: newUsers,
      subscribed,
      neverSubscribed: total - everSubscribed,
    },
    circles: {
      usersByLoginType: toCircle(result.byLoginType, { keys: Object.values(LOGIN_TYPES) }),
      usersByStatus: byStatus,
      usersByVerification: toCircle(result.byVerification, {
        keys: ["both", "email_only", "mobile_only", "none"],
      }),
    },
    trend: { signups: result.trend },
  };
};
