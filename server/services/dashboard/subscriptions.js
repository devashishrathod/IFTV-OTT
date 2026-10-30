const UserSubscription = require("../../models/UserSubscription");
const SubscriptionSetting = require("../../models/SubscriptionSetting");
const User = require("../../models/User");
const {
  PLATFORMS,
  USER_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_SOURCES,
  DASHBOARD_LIMITS,
} = require("../../constants");
const { ENTITLED_STATUSES } = require("../subscriptions/periods");
const { inRange, bucketKey, addDays, DAY_MS } = require("./dateRange");
const { toCircle, toKpi, first } = require("./helpers");

const { ACTIVE, SCHEDULED, EXPIRED } = USER_SUBSCRIPTION_STATUSES;
// Periods that ran to their endDate (upgraded / cancelled ones ended early)
const NATURAL_END_STATUSES = [ACTIVE, SCHEDULED, EXPIRED];

const USER_FIELDS = { _id: 1, name: 1, email: 1, mobile: 1, image: 1 };

// Same rule as access checks: dates decide, the stored status only narrows
const currentMatch = (base, now) => ({
  ...base,
  status: { $in: ENTITLED_STATUSES },
  startDate: { $lte: now },
  endDate: { $gt: now },
});

/**
 * Current periods ending within EXPIRING_SOON_DAYS whose user has nothing
 * lined up after them, soonest first.
 */
const expiringSoon = (base, now, limit) =>
  UserSubscription.aggregate([
    {
      $match: {
        ...currentMatch(base, now),
        endDate: { $gt: now, $lte: addDays(now, DASHBOARD_LIMITS.EXPIRING_SOON_DAYS) },
      },
    },
    {
      $lookup: {
        from: UserSubscription.collection.name,
        let: { userId: "$userId", endDate: "$endDate" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$userId", "$$userId"] },
                  { $in: ["$status", ENTITLED_STATUSES] },
                  { $gte: ["$startDate", "$$endDate"] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: "next",
      },
    },
    { $match: { next: { $size: 0 } } },
    {
      $facet: {
        total: [{ $count: "count" }],
        items: [
          { $sort: { endDate: 1, _id: 1 } },
          { $limit: limit },
          {
            $lookup: {
              from: User.collection.name,
              localField: "userId",
              foreignField: "_id",
              pipeline: [{ $project: USER_FIELDS }],
              as: "user",
            },
          },
        ],
      },
    },
  ]);

const toExpiringItem = (p, now) => ({
  _id: p._id,
  user: p.user?.[0] || null,
  planId: p.planId,
  plan: p.plan,
  status: ACTIVE,
  source: p.source,
  startDate: p.startDate,
  endDate: p.endDate,
  daysLeft: Math.max(0, Math.ceil((p.endDate - now) / DAY_MS)),
  amountPaid: p.amountPaid,
  platform: p.platform,
  createdAt: p.createdAt,
});

/**
 * Subscribers today (snapshot) and subscription periods started / ended in
 * the date range. platform / planId narrow everything here.
 */
exports.subscriptionsSection = async ({ period, filters, now }) => {
  const { current, previous, groupBy } = period;
  const base = filters.subscriptionMatch;
  // Expired = endDate passed inside the range (a future endDate hasn't expired)
  const expiredRange = { start: current.start, end: new Date(Math.min(current.end, now)) };
  const expiredIn = {
    $match: { status: { $in: NATURAL_END_STATUSES }, endDate: inRange(expiredRange) },
  };
  const createdIn = { $match: { createdAt: inRange(current) } };

  const facet = {
    bySource: [createdIn, { $group: { _id: "$source", count: { $sum: 1 } } }],
    expired: [expiredIn, { $count: "count" }],
    cancelled: [{ $match: { cancelledAt: inRange(current) } }, { $count: "count" }],
    scheduled: [
      { $match: { status: { $in: ENTITLED_STATUSES }, startDate: { $gt: now } } },
      { $count: "count" },
    ],
    newTrend: [createdIn, { $group: { _id: bucketKey("$createdAt", groupBy), count: { $sum: 1 } } }],
    expiredTrend: [
      expiredIn,
      { $group: { _id: bucketKey("$endDate", groupBy), count: { $sum: 1 } } },
    ],
  };
  if (previous) {
    facet.previous = [{ $match: { createdAt: inRange(previous) } }, { $count: "count" }];
  }

  const [[flow], [subscribers], [expiring], setting] = await Promise.all([
    UserSubscription.aggregate([{ $match: base }, { $facet: facet }]),
    // One row per subscriber, so a user is never counted twice
    UserSubscription.aggregate([
      { $match: currentMatch(base, now) },
      { $sort: { endDate: -1 } },
      {
        $group: {
          _id: "$userId",
          planId: { $first: "$planId" },
          name: { $first: "$plan.name" },
          platform: { $first: "$platform" },
        },
      },
      {
        $facet: {
          total: [{ $count: "count" }],
          byPlan: [{ $group: { _id: "$planId", name: { $first: "$name" }, count: { $sum: 1 } } }],
          byPlatform: [{ $group: { _id: "$platform", count: { $sum: 1 } } }],
        },
      },
    ]),
    expiringSoon(base, now, filters.recentLimit),
    SubscriptionSetting.findOne({ key: "default" }).lean(),
  ]);

  const bySource = toCircle(flow.bySource, { keys: Object.values(SUBSCRIPTION_SOURCES) });
  const activeSubscribers = first(subscribers.total).count || 0;

  return {
    kpis: {
      newSubscriptions: toKpi(
        bySource.total,
        previous ? first(flow.previous).count || 0 : null
      ),
      activeSubscribers,
    },
    section: {
      activeSubscribers,
      scheduled: first(flow.scheduled).count || 0,
      expiringIn7Days: first(expiring.total).count || 0,
      newInRange: bySource.total,
      expiredInRange: first(flow.expired).count || 0,
      cancelledInRange: first(flow.cancelled).count || 0,
      adminGrantsInRange:
        bySource.items.find((i) => i.key === SUBSCRIPTION_SOURCES.ADMIN_GRANT)?.count || 0,
      upgradeAllowed: Boolean(setting?.allowUpgrade),
    },
    circles: {
      activeSubscribersByPlan: toCircle(subscribers.byPlan, { labelOf: (row) => row.name }),
      activeSubscribersByPlatform: toCircle(subscribers.byPlatform, {
        keys: Object.values(PLATFORMS),
      }),
      subscriptionsBySource: bySource,
    },
    trend: { created: flow.newTrend, expired: flow.expiredTrend },
    expiringSoon: expiring.items.map((p) => toExpiringItem(p, now)),
  };
};
