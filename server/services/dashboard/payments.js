const Payment = require("../../models/Payment");
const {
  PLATFORMS,
  PAYMENT_STATUSES,
  PAYMENT_PURPOSES,
} = require("../../constants");
const { inRange, bucketKey, startOfDay, startOfMonth } = require("./dateRange");
const { toCircle, toKpi, toCounts, first, percentOf } = require("./helpers");

const { PAID, FAILED, EXPIRED } = PAYMENT_STATUSES;

const sumPaid = { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } };
const toTotal = (rows) => {
  const row = first(rows);
  return { amount: row.amount || 0, count: row.count || 0 };
};

/**
 * Revenue (paise) and payment numbers. Revenue is counted on paidAt, status
 * circles on createdAt. platform / planId narrow everything here.
 */
exports.paymentsSection = async ({ period, filters, now }) => {
  const { current, previous, groupBy } = period;
  const paidIn = (range) => ({ $match: { status: PAID, paidAt: inRange(range) } });
  const facet = {
    today: [{ $match: { status: PAID, paidAt: { $gte: startOfDay(now) } } }, { $group: sumPaid }],
    thisMonth: [{ $match: { status: PAID, paidAt: { $gte: startOfMonth(now) } } }, { $group: sumPaid }],
    allTime: [{ $match: { status: PAID } }, { $group: sumPaid }],
    range: [
      paidIn(current),
      { $group: { ...sumPaid, creditApplied: { $sum: "$creditApplied" } } },
    ],
    byStatus: [
      { $match: { createdAt: inRange(current) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ],
    byPurpose: [paidIn(current), { $group: { _id: "$purpose", count: { $sum: 1 } } }],
    byMethod: [
      paidIn(current),
      { $group: { _id: "$method", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
    ],
    byPlatform: [
      paidIn(current),
      { $group: { _id: "$platform", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
    ],
    byPlan: [
      paidIn(current),
      {
        $group: {
          _id: "$planId",
          name: { $last: "$plan.name" },
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
    ],
    paidTrend: [
      paidIn(current),
      {
        $group: {
          _id: bucketKey("$paidAt", groupBy),
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
    ],
    failedTrend: [
      { $match: { status: FAILED, createdAt: inRange(current) } },
      { $group: { _id: bucketKey("$createdAt", groupBy), count: { $sum: 1 } } },
    ],
  };
  if (previous) facet.previous = [paidIn(previous), { $group: sumPaid }];

  const [result] = await Payment.aggregate([
    { $match: filters.paymentMatch },
    { $facet: facet },
  ]);

  const range = toTotal(result.range);
  const prev = previous ? toTotal(result.previous) : null;
  const statusCounts = toCounts(Object.values(PAYMENT_STATUSES), result.byStatus);
  // Pending (created) orders are left out: they haven't succeeded or failed yet
  const settled = statusCounts[PAID] + statusCounts[FAILED] + statusCounts[EXPIRED];

  return {
    kpis: {
      revenue: toKpi(range.amount, prev?.amount),
      paidPayments: toKpi(range.count, prev?.count),
    },
    section: {
      today: toTotal(result.today),
      thisMonth: toTotal(result.thisMonth),
      range,
      allTime: toTotal(result.allTime),
      averageOrderValue: range.count ? Math.round(range.amount / range.count) : 0,
      successRatePercent: settled ? percentOf(statusCounts[PAID], settled) : null,
      creditAppliedInRange: first(result.range).creditApplied || 0,
    },
    circles: {
      paymentsByStatus: toCircle(result.byStatus, { keys: Object.values(PAYMENT_STATUSES) }),
      paymentsByPurpose: toCircle(result.byPurpose, { keys: Object.values(PAYMENT_PURPOSES) }),
      paymentsByMethod: toCircle(result.byMethod),
      revenueByPlatform: toCircle(result.byPlatform, {
        keys: Object.values(PLATFORMS),
        by: "amount",
      }),
      revenueByPlan: toCircle(result.byPlan, { by: "amount", labelOf: (row) => row.name }),
    },
    trend: { paid: result.paidTrend, failed: result.failedTrend },
  };
};
