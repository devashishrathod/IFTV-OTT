const UserSubscription = require("../../models/UserSubscription");
const Subscription = require("../../models/Subscription");
const { USER_SUBSCRIPTION_STATUSES } = require("../../constants");
const { throwError, validateObjectId } = require("../../utils");

const { ACTIVE, SCHEDULED, EXPIRED } = USER_SUBSCRIPTION_STATUSES;
const DAY_MS = 24 * 60 * 60 * 1000;

// Statuses that give access (now or later), always together with the dates
const ENTITLED_STATUSES = [ACTIVE, SCHEDULED];

exports.DAY_MS = DAY_MS;
exports.ENTITLED_STATUSES = ENTITLED_STATUSES;

exports.toPaise = (rupees) => Math.round(Number(rupees || 0) * 100);

exports.addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

exports.formatDate = (date) =>
  new Date(date).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

exports.planSnapshotOf = (plan, durationInDays = plan.durationInDays) => ({
  name: plan.name,
  type: plan.type,
  price: plan.price,
  durationInDays,
  benefits: plan.benefits || [],
});

exports.toPlanView = (plan) => ({
  _id: plan._id,
  name: plan.name,
  description: plan.description,
  type: plan.type,
  price: plan.price,
  currency: plan.currency,
  durationInDays: plan.durationInDays,
  benefits: plan.benefits || [],
  limitations: plan.limitations || [],
  sortOrder: plan.sortOrder ?? 0,
  isPopular: Boolean(plan.isPopular),
});

const ACTIVE_PLANS_FILTER = { isActive: true, isDeleted: false };
const PLAN_SORT = { sortOrder: 1, price: 1, createdAt: 1 };

exports.getActivePlans = () =>
  Subscription.find(ACTIVE_PLANS_FILTER).sort(PLAN_SORT).lean();

/**
 * A plan a user can buy right now: active, not deleted and at least ₹1.
 */
exports.findPurchasablePlan = async (planId) => {
  validateObjectId(planId, "plan Id");
  const plan = await Subscription.findOne({ _id: planId, ...ACTIVE_PLANS_FILTER });
  if (!plan) throwError(404, "Plan not found or no longer available");
  return plan;
};

/**
 * Periods that give access now or later, oldest start first.
 */
exports.getOpenPeriods = (userId, now = new Date(), session = null) =>
  UserSubscription.find({
    userId,
    status: { $in: ENTITLED_STATUSES },
    endDate: { $gt: now },
  })
    .sort({ startDate: 1, _id: 1 })
    .session(session);

exports.splitPeriods = (periods, now = new Date()) => ({
  current:
    periods.find((p) => p.startDate <= now && p.endDate > now) || null,
  scheduled: periods.filter((p) => p.startDate > now),
});

/**
 * The period giving access right now, or null.
 */
exports.getCurrentPeriod = (userId, now = new Date()) =>
  UserSubscription.findOne({
    userId,
    status: { $in: ENTITLED_STATUSES },
    startDate: { $lte: now },
    endDate: { $gt: now },
  }).sort({ endDate: -1 });

// A new period starts when every open period has ended (or now).
exports.nextStartDate = (periods, now = new Date()) =>
  periods.reduce(
    (latest, p) => (p.endDate > latest ? p.endDate : latest),
    now
  );

exports.effectiveStatus = (period, now = new Date()) => {
  if (!ENTITLED_STATUSES.includes(period.status)) return period.status;
  if (period.endDate <= now) return EXPIRED;
  return period.startDate <= now ? ACTIVE : SCHEDULED;
};

/**
 * Brings stored statuses in line with the dates. Access never depends on
 * this, it only keeps lists and filters accurate.
 */
exports.syncStatuses = async (filter = {}, now = new Date()) => {
  await UserSubscription.updateMany(
    { ...filter, status: { $in: ENTITLED_STATUSES }, endDate: { $lte: now } },
    { $set: { status: EXPIRED } }
  );
  await UserSubscription.updateMany(
    {
      ...filter,
      status: SCHEDULED,
      startDate: { $lte: now },
      endDate: { $gt: now },
    },
    { $set: { status: ACTIVE } }
  );
};

/**
 * Lines scheduled periods up one after another, right after the current
 * period (or from now when there is none), keeping each one's length. Used
 * after an upgrade or a cancel changes where the current period ends.
 */
exports.rechainScheduled = async (userId, now = new Date(), session = null) => {
  const periods = await exports.getOpenPeriods(userId, now, session);
  const { current, scheduled } = exports.splitPeriods(periods, now);
  let cursor = current ? current.endDate : now;
  for (const period of scheduled) {
    const length = period.endDate - period.startDate;
    if (period.startDate.getTime() !== cursor.getTime()) {
      period.startDate = cursor;
      period.endDate = new Date(cursor.getTime() + length);
      period.status = cursor <= now ? ACTIVE : SCHEDULED;
      await period.save({ session });
    }
    cursor = period.endDate;
  }
};

const daysLeft = (period, now) =>
  Math.max(0, Math.ceil((period.endDate - now) / DAY_MS));

/**
 * What a user sees of their own subscription period.
 */
exports.toUserSubscriptionView = (period, now = new Date()) => {
  const p = period.toObject ? period.toObject() : period;
  const status = exports.effectiveStatus(p, now);
  return {
    _id: p._id,
    planId: p.planId,
    plan: p.plan,
    status,
    source: p.source,
    startDate: p.startDate,
    endDate: p.endDate,
    endedAt: p.endedAt,
    daysLeft: status === ACTIVE ? daysLeft(p, now) : undefined,
    amountPaid: p.amountPaid,
    creditApplied: p.creditApplied,
    paymentId: p.paymentId,
    previousSubscriptionId: p.previousSubscriptionId,
    cancelledAt: p.cancelledAt,
    platform: p.platform,
    createdAt: p.createdAt,
  };
};

/**
 * Admin view: everything except the reminder bookkeeping.
 */
exports.toAdminSubscriptionView = (period, now = new Date()) => {
  const { remindersSent, ...p } = period.toObject ? period.toObject() : period;
  const status = exports.effectiveStatus(p, now);
  return {
    ...p,
    status,
    daysLeft: status === ACTIVE ? daysLeft(p, now) : undefined,
  };
};
