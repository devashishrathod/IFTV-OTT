const User = require("../../models/User");
const Payment = require("../../models/Payment");
const UserSubscription = require("../../models/UserSubscription");
const SupportTicket = require("../../models/SupportTicket");
const Movie = require("../../models/Movie");
const { PAYMENT_STATUSES } = require("../../constants");
const { toAdminSubscriptionView } = require("../subscriptions/periods");
const { USER_MATCH } = require("./users");

const USER_REF = "name email mobile image";

const PAYMENT_FIELDS =
  "receipt userId planId plan.name plan.type plan.price amount currency purpose method platform status failureReason paidAt createdAt";

// userId → user, the name the admin panel lists already use
const withUser = ({ userId, ...row }) => ({ ...row, user: userId || null });

const toRecentSubscription = (period, now) => {
  const view = toAdminSubscriptionView(period, now);
  return {
    _id: view._id,
    user: view.userId || null,
    planId: view.planId,
    plan: view.plan,
    status: view.status,
    source: view.source,
    startDate: view.startDate,
    endDate: view.endDate,
    daysLeft: view.daysLeft,
    amountPaid: view.amountPaid,
    platform: view.platform,
    createdAt: view.createdAt,
  };
};

/**
 * Latest records, newest first. No date range: these are always the most
 * recent. platform / planId / categoryId apply where the record has them.
 */
exports.recentLists = async ({ filters, now }) => {
  const limit = filters.recentLimit;
  const payments = (status, sort) =>
    Payment.find({ ...filters.paymentMatch, status })
      .sort(sort)
      .limit(limit)
      .select(PAYMENT_FIELDS)
      .populate("userId", USER_REF)
      .lean();

  const [users, paid, failed, subscriptions, tickets, movies] = await Promise.all([
    User.find(USER_MATCH)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("name email mobile image loginType isActive isEmailVerified isMobileVerified createdAt")
      .lean(),
    payments(PAYMENT_STATUSES.PAID, { paidAt: -1 }),
    payments(PAYMENT_STATUSES.FAILED, { createdAt: -1 }),
    UserSubscription.find(filters.subscriptionMatch)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("userId", USER_REF)
      .lean(),
    SupportTicket.find(filters.ticketMatch)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select(
        "ticketId source user name email mobile category subject status priority platform assignedTo lastReplyAt createdAt"
      )
      .populate("user", USER_REF)
      .lean(),
    Movie.find(filters.movieMatch)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("title image accessType categoryId languages durationInSeconds releaseDate isActive createdAt")
      .populate("categoryId", "name")
      .lean(),
  ]);

  return {
    users,
    payments: paid.map(withUser),
    failedPayments: failed.map(withUser),
    subscriptions: subscriptions.map((p) => toRecentSubscription(p, now)),
    tickets,
    movies: movies.map(({ categoryId, ...movie }) => ({ ...movie, category: categoryId || null })),
  };
};
