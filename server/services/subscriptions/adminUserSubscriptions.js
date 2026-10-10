const mongoose = require("mongoose");
const UserSubscription = require("../../models/UserSubscription");
const Subscription = require("../../models/Subscription");
const Payment = require("../../models/Payment");
const User = require("../../models/User");
const {
  USER_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_SOURCES,
  PAYMENT_STATUSES,
} = require("../../constants");
const { pagination, throwError, validateObjectId } = require("../../utils");
const {
  ENTITLED_STATUSES,
  addDays,
  planSnapshotOf,
  getOpenPeriods,
  splitPeriods,
  nextStartDate,
  syncStatuses,
  rechainScheduled,
  toAdminSubscriptionView,
} = require("./periods");

const { ObjectId } = mongoose.Types;

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildDateRange = (fromDate, toDate) => {
  if (!fromDate && !toDate) return undefined;
  const range = {};
  if (fromDate) range.$gte = new Date(fromDate);
  if (toDate) {
    const d = new Date(toDate);
    d.setHours(23, 59, 59, 999);
    range.$lte = d;
  }
  return range;
};

exports.adminGetUserSubscriptions = async (query) => {
  let {
    page,
    limit,
    status,
    planId,
    userId,
    source,
    platform,
    search,
    fromDate,
    toDate,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;
  page = page ? Number(page) : 1;
  limit = limit ? Number(limit) : 10;
  const now = new Date();
  await syncStatuses({}, now);
  const match = {};
  if (status) match.status = status;
  if (planId) match.planId = new ObjectId(planId);
  if (userId) match.userId = new ObjectId(userId);
  if (source) match.source = source;
  if (platform) match.platform = platform;
  const createdAt = buildDateRange(fromDate, toDate);
  if (createdAt) match.createdAt = createdAt;
  const direction = sortOrder === "asc" ? 1 : -1;
  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
        pipeline: [{ $project: { name: 1, email: 1, mobile: 1 } }],
      },
    },
    { $set: { user: { $arrayElemAt: ["$user", 0] } } },
  ];
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    pipeline.push(
      { $set: { userMobileText: { $toString: "$user.mobile" } } },
      {
        $match: {
          $or: [
            { "user.name": regex },
            { "user.email": regex },
            { userMobileText: regex },
            { "plan.name": regex },
          ],
        },
      },
      { $unset: "userMobileText" }
    );
  }
  pipeline.push(
    { $project: { remindersSent: 0 } },
    { $sort: { [sortBy]: direction, _id: direction } }
  );
  const result = await pagination(UserSubscription, pipeline, page, limit, {
    allowEmpty: true,
  });
  result.data = result.data.map((p) => toAdminSubscriptionView(p, now));
  return result;
};

/**
 * One user's subscription page in the admin panel: profile, current and
 * scheduled periods, full history and a payment summary.
 */
exports.adminGetUserSubscriptionDetail = async (userId) => {
  validateObjectId(userId, "user Id");
  const user = await User.findOne({ _id: userId, isDeleted: false })
    .select("name email mobile role isActive createdAt")
    .lean();
  if (!user) throwError(404, "User not found");
  const now = new Date();
  await syncStatuses({ userId }, now);
  const [periods, history, [paymentSummary]] = await Promise.all([
    getOpenPeriods(userId, now),
    UserSubscription.find({ userId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .lean(),
    Payment.aggregate([
      { $match: { userId: new ObjectId(userId), status: PAYMENT_STATUSES.PAID } },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: "$amount" },
          paymentsCount: { $sum: 1 },
          lastPaymentAt: { $max: "$paidAt" },
        },
      },
    ]),
  ]);
  const { current, scheduled } = splitPeriods(periods, now);
  return {
    user,
    isSubscribed: Boolean(current),
    current: current ? toAdminSubscriptionView(current, now) : null,
    scheduled: scheduled.map((p) => toAdminSubscriptionView(p, now)),
    history: history.map((p) => toAdminSubscriptionView(p, now)),
    payments: {
      totalPaid: paymentSummary?.totalPaid || 0,
      paymentsCount: paymentSummary?.paymentsCount || 0,
      lastPaymentAt: paymentSummary?.lastPaymentAt || null,
    },
  };
};

/**
 * Free (complimentary) plan from the admin. Starts now, or right after the
 * user's open periods so nothing overlaps.
 */
exports.adminGrantSubscription = async ({ userId, planId, days, note }, adminId) => {
  const user = await User.findOne({ _id: userId, isDeleted: false }).lean();
  if (!user) throwError(404, "User not found");
  const plan = await Subscription.findOne({ _id: planId, isDeleted: false }).lean();
  if (!plan) throwError(404, "Plan not found");
  const durationInDays = days || plan.durationInDays;
  const now = new Date();
  const periods = await getOpenPeriods(userId, now);
  const startDate = nextStartDate(periods, now);
  const previous = periods.find((p) => p.endDate.getTime() === startDate.getTime());
  const period = await UserSubscription.create({
    userId,
    planId,
    plan: planSnapshotOf(plan, durationInDays),
    status:
      startDate <= now
        ? USER_SUBSCRIPTION_STATUSES.ACTIVE
        : USER_SUBSCRIPTION_STATUSES.SCHEDULED,
    source: SUBSCRIPTION_SOURCES.ADMIN_GRANT,
    startDate,
    endDate: addDays(startDate, durationInDays),
    previousSubscriptionId: previous?._id,
    amountPaid: 0,
    creditApplied: 0,
    grantedBy: adminId,
    note: note || undefined,
  });
  return toAdminSubscriptionView(period, now);
};

/**
 * Ends a period right away (no refund). Later scheduled periods move up so
 * the user has no gap.
 */
exports.adminCancelSubscription = async (id, { reason }, adminId) => {
  validateObjectId(id, "Subscription Id");
  const now = new Date();
  const period = await UserSubscription.findOne({
    _id: id,
    status: { $in: ENTITLED_STATUSES },
    endDate: { $gt: now },
  });
  if (!period) {
    const exists = await UserSubscription.exists({ _id: id });
    if (!exists) throwError(404, "Subscription not found");
    throwError(409, "Only active or scheduled subscriptions can be cancelled");
  }
  const { current } = splitPeriods([period], now);
  period.status = USER_SUBSCRIPTION_STATUSES.CANCELLED;
  period.cancelledAt = now;
  period.cancelledBy = adminId;
  period.cancelReason = reason || undefined;
  if (current) period.endedAt = now;
  await period.save();
  await rechainScheduled(period.userId, now);
  return toAdminSubscriptionView(period, now);
};
