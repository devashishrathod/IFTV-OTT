const mongoose = require("mongoose");
const User = require("../../models/User");
const Payment = require("../../models/Payment");
const UserSubscription = require("../../models/UserSubscription");
const SupportTicket = require("../../models/SupportTicket");
const { DASHBOARD_RANGES, DASHBOARD_LIMITS, PAYMENT_LIMITS } = require("../../constants");
const { firstActivityDay } = require("../movies/activityHelpers");
const { resolvePeriod, buildBuckets, toDayString } = require("./dateRange");
const { usersSection, USER_MATCH } = require("./users");
const { paymentsSection } = require("./payments");
const { subscriptionsSection } = require("./subscriptions");
const { supportSection } = require("./support");
const { contentSection } = require("./content");
const { movieActivitySection } = require("./movieActivity");
const { recentLists } = require("./recent");

const { ObjectId } = mongoose.Types;

// all_time starts at the oldest user, payment, subscription, ticket or movie view
const findFirstRecordAt = async () => {
  const oldest = (Model, match = {}) =>
    Model.findOne(match).sort({ createdAt: 1 }).select("createdAt").lean();
  const [firstMovieDay, ...rows] = await Promise.all([
    // Movie activity is dated by its IST day
    firstActivityDay(),
    oldest(User, USER_MATCH),
    oldest(Payment),
    oldest(UserSubscription),
    oldest(SupportTicket, { isDeleted: false }),
  ]);
  const dates = rows.filter(Boolean).map((row) => row.createdAt.getTime());
  if (firstMovieDay) dates.push(firstMovieDay.getTime());
  return dates.length ? new Date(Math.min(...dates)) : null;
};

// Each model's match for the filters that apply to it (aggregates need ObjectIds)
const buildFilters = ({ platform, planId, categoryId, recentLimit }) => {
  const byPlatform = platform ? { platform } : {};
  const byPlan = planId ? { planId: new ObjectId(planId) } : {};
  return {
    recentLimit: recentLimit || DASHBOARD_LIMITS.DEFAULT_RECENT_LIMIT,
    platform: platform || null,
    paymentMatch: { ...byPlatform, ...byPlan },
    subscriptionMatch: { ...byPlatform, ...byPlan },
    ticketMatch: { isDeleted: false, ...byPlatform },
    movieMatch: { isDeleted: false, ...(categoryId ? { categoryId: new ObjectId(categoryId) } : {}) },
  };
};

const rangeView = (range) =>
  range
    ? { fromDate: toDayString(range.start), toDate: toDayString(new Date(range.end - 1)) }
    : { fromDate: null, toDate: null };

// { "2026-10-01": row } for one chart series
const byBucket = (rows = []) => new Map(rows.map((row) => [row._id, row]));

const buildChart = (period, { users, payments, subscriptions, support, movies }) => {
  const series = {
    movieViews: [byBucket(movies.trend.activity), "views"],
    moviePlays: [byBucket(movies.trend.activity), "plays"],
    signups: [byBucket(users.trend.signups), "count"],
    revenue: [byBucket(payments.trend.paid), "amount"],
    paidPayments: [byBucket(payments.trend.paid), "count"],
    failedPayments: [byBucket(payments.trend.failed), "count"],
    newSubscriptions: [byBucket(subscriptions.trend.created), "count"],
    expiredSubscriptions: [byBucket(subscriptions.trend.expired), "count"],
    tickets: [byBucket(support.trend.created), "count"],
    resolvedTickets: [byBucket(support.trend.done), "count"],
  };
  return {
    groupBy: period.groupBy,
    points: buildBuckets(period.current, period.groupBy).map((bucket) => {
      const point = { ...bucket };
      for (const [name, [rows, field]] of Object.entries(series)) {
        point[name] = rows.get(bucket.date)?.[field] || 0;
      }
      return point;
    }),
  };
};

/**
 * Everything the admin panel home page shows, in one call. Flow numbers
 * (signups, payments, new subscriptions, tickets) follow the date range;
 * state numbers (subscribers, catalog, open tickets) are as of now.
 */
exports.getAdminDashboard = async (query) => {
  const now = new Date();
  const firstRecordAt =
    query.range === DASHBOARD_RANGES.ALL_TIME ? await findFirstRecordAt() : null;
  const period = resolvePeriod(query, now, firstRecordAt);
  const filters = buildFilters(query);
  const context = { period, filters, now };

  const [users, payments, subscriptions, support, content, movies, recent] = await Promise.all([
    usersSection(context),
    paymentsSection(context),
    subscriptionsSection(context),
    supportSection(context),
    contentSection(context),
    movieActivitySection(context),
    recentLists(context),
  ]);

  const previous = rangeView(period.previous);
  return {
    filters: {
      range: query.range,
      ...rangeView(period.current),
      days: period.days,
      groupBy: period.groupBy,
      platform: query.platform || null,
      planId: query.planId || null,
      categoryId: query.categoryId || null,
      recentLimit: filters.recentLimit,
      compare: Boolean(period.previous),
      previousFromDate: previous.fromDate,
      previousToDate: previous.toDate,
      timezone: DASHBOARD_LIMITS.TIMEZONE,
      currency: PAYMENT_LIMITS.CURRENCY,
      amountUnit: "paise",
    },
    overview: {
      newUsers: users.kpis.newUsers,
      revenue: payments.kpis.revenue,
      paidPayments: payments.kpis.paidPayments,
      newSubscriptions: subscriptions.kpis.newSubscriptions,
      newTickets: support.kpis.newTickets,
      totalUsers: users.kpis.totalUsers,
      activeSubscribers: subscriptions.kpis.activeSubscribers,
      openTickets: support.kpis.openTickets,
      totalMovies: content.kpis.totalMovies,
      movieViews: movies.kpis.movieViews,
      moviePlays: movies.kpis.moviePlays,
    },
    charts: buildChart(period, { users, payments, subscriptions, support, movies }),
    circles: {
      ...users.circles,
      ...payments.circles,
      ...subscriptions.circles,
      ...support.circles,
      ...content.circles,
    },
    users: users.section,
    subscriptions: subscriptions.section,
    revenue: payments.section,
    // topMovies follows the date range; the rest of content is as of now
    content: { ...content.section, topMovies: movies.topMovies },
    support: support.section,
    recent: {
      users: recent.users,
      payments: recent.payments,
      failedPayments: recent.failedPayments,
      subscriptions: recent.subscriptions,
      expiringSoon: subscriptions.expiringSoon,
      tickets: recent.tickets,
      movies: recent.movies,
    },
  };
};
