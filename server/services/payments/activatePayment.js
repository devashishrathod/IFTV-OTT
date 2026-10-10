const mongoose = require("mongoose");
const Payment = require("../../models/Payment");
const UserSubscription = require("../../models/UserSubscription");
const User = require("../../models/User");
const {
  PAYMENT_STATUSES,
  PAYMENT_PURPOSES,
  USER_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_SOURCES,
} = require("../../constants");
const { sendPaymentSuccessMail } = require("../../helpers/nodeMailer");
const {
  addDays,
  getOpenPeriods,
  splitPeriods,
  nextStartDate,
  rechainScheduled,
} = require("../subscriptions/periods");

const { ACTIVE, SCHEDULED, UPGRADED } = USER_SUBSCRIPTION_STATUSES;

// Money taken on an expired / failed attempt still activates the plan
const ACTIVATABLE_STATUSES = [
  PAYMENT_STATUSES.CREATED,
  PAYMENT_STATUSES.EXPIRED,
  PAYMENT_STATUSES.FAILED,
];

const createPeriodForPayment = async (payment, now, session) => {
  const periods = await getOpenPeriods(payment.userId, now, session);
  const { current } = splitPeriods(periods, now);
  const base = {
    userId: payment.userId,
    planId: payment.planId,
    plan: payment.plan,
    paymentId: payment._id,
    amountPaid: payment.amount,
    creditApplied: payment.creditApplied,
    platform: payment.platform,
  };
  const days = payment.plan.durationInDays;

  const upgradeFrom =
    payment.purpose === PAYMENT_PURPOSES.UPGRADE &&
    current &&
    String(current._id) === String(payment.upgradeFromSubscriptionId)
      ? current
      : null;
  if (upgradeFrom) {
    upgradeFrom.status = UPGRADED;
    upgradeFrom.endedAt = now;
    await upgradeFrom.save({ session });
    const [period] = await UserSubscription.create(
      [
        {
          ...base,
          status: ACTIVE,
          source: SUBSCRIPTION_SOURCES.UPGRADE,
          startDate: now,
          endDate: addDays(now, days),
          previousSubscriptionId: upgradeFrom._id,
        },
      ],
      { session }
    );
    // A renewal queued behind the old plan now waits for the new one
    await rechainScheduled(payment.userId, now, session);
    return period;
  }

  // New / renewal, or an upgrade whose old period is already gone (paid
  // late): queue after whatever is open so no paid time is lost.
  const startDate = nextStartDate(periods, now);
  const previous = periods.find(
    (p) => p.endDate.getTime() === startDate.getTime()
  );
  let source = SUBSCRIPTION_SOURCES.PURCHASE;
  if (payment.purpose === PAYMENT_PURPOSES.RENEWAL) {
    source = SUBSCRIPTION_SOURCES.RENEWAL;
  } else if (payment.purpose === PAYMENT_PURPOSES.UPGRADE && startDate > now) {
    source = SUBSCRIPTION_SOURCES.RENEWAL;
  }
  const [period] = await UserSubscription.create(
    [
      {
        ...base,
        status: startDate <= now ? ACTIVE : SCHEDULED,
        source,
        startDate,
        endDate: addDays(startDate, days),
        previousSubscriptionId: previous?._id,
      },
    ],
    { session }
  );
  return period;
};

/**
 * Marks a payment paid and creates its subscription period, in one
 * transaction. Safe to call any number of times (verify API, webhook, admin
 * sync): only the first call that moves the payment to "paid" creates the
 * period, the others get the existing result back.
 */
exports.activatePayment = async (paymentId, rpPayment, { signature } = {}) => {
  const session = await mongoose.startSession();
  let outcome = null;
  try {
    await session.withTransaction(async () => {
      outcome = null;
      const now = new Date();
      const set = {
        status: PAYMENT_STATUSES.PAID,
        razorpayPaymentId: rpPayment.id,
        method: rpPayment.method,
        paidAt: now,
      };
      if (signature) set.razorpaySignature = signature;
      const payment = await Payment.findOneAndUpdate(
        { _id: paymentId, status: { $in: ACTIVATABLE_STATUSES } },
        { $set: set, $unset: { failureReason: 1 } },
        { returnDocument: "after", session }
      );
      if (!payment) return;
      const period = await createPeriodForPayment(payment, now, session);
      payment.userSubscriptionId = period._id;
      await payment.save({ session });
      outcome = { payment, subscription: period };
    });
  } finally {
    await session.endSession();
  }

  if (!outcome) {
    const payment = await Payment.findById(paymentId);
    const subscription = payment?.userSubscriptionId
      ? await UserSubscription.findById(payment.userSubscriptionId)
      : null;
    return { payment, subscription, alreadyProcessed: true };
  }

  User.findById(outcome.payment.userId)
    .select("name email")
    .lean()
    .then((user) =>
      sendPaymentSuccessMail(user, outcome.payment, outcome.subscription)
    )
    .catch((err) => console.error("Payment mail failed:", err.message));
  return { ...outcome, alreadyProcessed: false };
};
