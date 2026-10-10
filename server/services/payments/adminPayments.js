const mongoose = require("mongoose");
const Payment = require("../../models/Payment");
const UserSubscription = require("../../models/UserSubscription");
const User = require("../../models/User");
const {
  PAYMENT_STATUSES,
  PAYMENT_PURPOSES,
  PAYMENT_LIMITS,
} = require("../../constants");
const {
  pagination,
  throwError,
  validateObjectId,
  CustomError,
} = require("../../utils");
const {
  ENTITLED_STATUSES,
  toAdminSubscriptionView,
} = require("../subscriptions/periods");
const {
  fetchRazorpayPayment,
  fetchRazorpayOrderPayments,
} = require("./razorpayGateway");
const { ensureCaptured } = require("./paymentHelpers");
const { activatePayment } = require("./activatePayment");

const { ObjectId } = mongoose.Types;
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

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

const USER_LOOKUP = [
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

exports.adminGetAllPayments = async (query) => {
  let {
    page,
    limit,
    status,
    purpose,
    planId,
    userId,
    method,
    platform,
    search,
    fromDate,
    toDate,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;
  page = page ? Number(page) : 1;
  limit = limit ? Number(limit) : 10;
  const match = {};
  if (status) match.status = status;
  if (purpose) match.purpose = purpose;
  if (planId) match.planId = new ObjectId(planId);
  if (userId) match.userId = new ObjectId(userId);
  if (method) match.method = method;
  if (platform) match.platform = platform;
  const createdAt = buildDateRange(fromDate, toDate);
  if (createdAt) match.createdAt = createdAt;
  const direction = sortOrder === "asc" ? 1 : -1;
  const pipeline = [{ $match: match }, ...USER_LOOKUP];
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    pipeline.push(
      { $set: { userMobileText: { $toString: "$user.mobile" } } },
      {
        $match: {
          $or: [
            { receipt: regex },
            { razorpayOrderId: regex },
            { razorpayPaymentId: regex },
            { "user.name": regex },
            { "user.email": regex },
            { userMobileText: regex },
          ],
        },
      },
      { $unset: "userMobileText" }
    );
  }
  pipeline.push(
    { $project: { razorpaySignature: 0 } },
    { $sort: { [sortBy]: direction, _id: direction } }
  );
  return await pagination(Payment, pipeline, page, limit, { allowEmpty: true });
};

const loadPayment = async (id) => {
  validateObjectId(id, "Payment Id");
  const payment = await Payment.findById(id);
  if (!payment) throwError(404, "Payment not found");
  return payment;
};

/**
 * One payment with its user, subscription period and the live Razorpay
 * record (best effort: the page still loads if Razorpay can't be reached).
 */
exports.adminGetPayment = async (id) => {
  const payment = await loadPayment(id);
  const [user, subscription] = await Promise.all([
    User.findById(payment.userId).select("name email mobile").lean(),
    payment.userSubscriptionId
      ? UserSubscription.findById(payment.userSubscriptionId).lean()
      : null,
  ]);
  let razorpay = null;
  let razorpayError;
  if (payment.razorpayPaymentId) {
    try {
      razorpay = await fetchRazorpayPayment(payment.razorpayPaymentId);
    } catch (err) {
      razorpayError = err.message;
    }
  }
  const { razorpaySignature, ...view } = payment.toObject();
  return {
    ...view,
    user,
    subscription: subscription ? toAdminSubscriptionView(subscription) : null,
    razorpay,
    razorpayError,
  };
};

/**
 * Re-checks an unpaid order with Razorpay, e.g. money was taken but neither
 * verify nor the webhook reached us. Activates it if a captured payment is
 * found.
 */
exports.adminSyncPayment = async (id) => {
  const payment = await loadPayment(id);
  if (payment.status === PAYMENT_STATUSES.PAID) {
    return { changed: false, payment: payment.toObject() };
  }
  const { items = [] } = await fetchRazorpayOrderPayments(payment.razorpayOrderId);
  const candidate =
    items.find((p) => p.status === "captured") ||
    items.find((p) => p.status === "authorized");
  if (candidate) {
    let captured = null;
    try {
      captured = await ensureCaptured(candidate, payment);
    } catch (err) {
      if (!(err instanceof CustomError) || err.statusCode !== 400) throw err;
      throwError(409, err.message);
    }
    if (captured) {
      const result = await activatePayment(payment._id, captured);
      return { changed: !result.alreadyProcessed, payment: result.payment.toObject() };
    }
  }
  const failed = items.filter((p) => p.status === "failed");
  if (
    payment.status === PAYMENT_STATUSES.CREATED &&
    items.length &&
    failed.length === items.length
  ) {
    payment.status = PAYMENT_STATUSES.FAILED;
    payment.failureReason = String(
      failed[failed.length - 1].error_description || "Payment failed"
    ).slice(0, PAYMENT_LIMITS.MAX_FAILURE_REASON_LENGTH);
    await payment.save();
    return { changed: true, payment: payment.toObject() };
  }
  return { changed: false, payment: payment.toObject() };
};

const startOfDayIST = (date) =>
  new Date(
    Math.floor((date.getTime() + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS
  );

const startOfMonthIST = (date) => {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS
  );
};

const sumRevenue = async (paidAt) => {
  const match = { status: PAYMENT_STATUSES.PAID };
  if (paidAt) match.paidAt = paidAt;
  const [row] = await Payment.aggregate([
    { $match: match },
    { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  return { amount: row?.amount || 0, count: row?.count || 0 };
};

const toCounts = (keys, rows = []) =>
  Object.fromEntries(
    keys.map((key) => [key, rows.find((r) => r._id === key)?.count || 0])
  );

/**
 * Revenue (paise) and subscriber numbers for the admin dashboard. Day and
 * month boundaries are in IST. fromDate / toDate narrow the "range" figures.
 */
exports.adminPaymentStats = async ({ fromDate, toDate }) => {
  const now = new Date();
  const range = buildDateRange(fromDate, toDate);
  const createdMatch = range ? { createdAt: range } : {};
  const paidMatch = { status: PAYMENT_STATUSES.PAID, ...(range ? { paidAt: range } : {}) };
  const currentMatch = {
    status: { $in: ENTITLED_STATUSES },
    startDate: { $lte: now },
    endDate: { $gt: now },
  };

  const [today, thisMonth, inRange, allTime, statusRows, purposeRows, byPlan, subscriberRows] =
    await Promise.all([
      sumRevenue({ $gte: startOfDayIST(now) }),
      sumRevenue({ $gte: startOfMonthIST(now) }),
      sumRevenue(range),
      sumRevenue(),
      Payment.aggregate([
        { $match: createdMatch },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: paidMatch },
        { $group: { _id: "$purpose", count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: paidMatch },
        {
          $group: {
            _id: "$planId",
            name: { $last: "$plan.name" },
            type: { $last: "$plan.type" },
            count: { $sum: 1 },
            revenue: { $sum: "$amount" },
          },
        },
        { $sort: { revenue: -1 } },
      ]),
      UserSubscription.aggregate([
        { $match: currentMatch },
        {
          $group: {
            _id: "$planId",
            name: { $last: "$plan.name" },
            users: { $addToSet: "$userId" },
          },
        },
        { $project: { name: 1, count: { $size: "$users" }, users: 1 } },
      ]),
    ]);

  const subscribers = new Set(
    subscriberRows.flatMap((row) => row.users.map(String))
  );
  return {
    currency: PAYMENT_LIMITS.CURRENCY,
    revenue: { today, thisMonth, range: inRange, allTime },
    paymentsByStatus: toCounts(Object.values(PAYMENT_STATUSES), statusRows),
    paidByPurpose: toCounts(Object.values(PAYMENT_PURPOSES), purposeRows),
    revenueByPlan: byPlan.map(({ _id, ...row }) => ({ planId: _id, ...row })),
    activeSubscribers: subscribers.size,
    activeSubscribersByPlan: subscriberRows.map(({ _id, name, count }) => ({
      planId: _id,
      name,
      count,
    })),
  };
};
