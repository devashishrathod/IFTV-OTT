const {
  PAYMENT_PURPOSES,
  PAYMENT_LIMITS,
  SUBSCRIPTION_LIMITS,
  SUBSCRIPTION_SOURCES,
} = require("../../constants");
const { throwError } = require("../../utils");
const {
  toPaise,
  addDays,
  formatDate,
  planSnapshotOf,
  splitPeriods,
  nextStartDate,
} = require("./periods");

/**
 * Decides what buying `plan` means for a user right now and what it costs.
 * Amounts are in paise. Throws 409 when the purchase is not allowed.
 *
 *  - no current plan           → new, starts now (or after a scheduled one)
 *  - same plan as current      → renewal, starts when the open periods end
 *  - costlier plan, upgrade ON → upgrade, starts now, unused value credited
 *  - anything else             → not allowed until the current plan ends
 */
exports.buildQuote = ({ plan, periods, settings, now = new Date() }) => {
  const planPrice = toPaise(plan.price);
  if (planPrice < PAYMENT_LIMITS.MIN_AMOUNT_PAISE) {
    throwError(422, "This plan can't be purchased");
  }
  const { current, scheduled } = splitPeriods(periods, now);
  const base = {
    planId: plan._id,
    plan: planSnapshotOf(plan),
    planPrice,
    currency: plan.currency || PAYMENT_LIMITS.CURRENCY,
    creditApplied: 0,
    payable: planPrice,
    currentSubscriptionId: current?._id || null,
  };
  const queued = (purpose) => {
    const startsAt = nextStartDate(periods, now);
    return {
      ...base,
      purpose,
      startsAt,
      endsAt: addDays(startsAt, plan.durationInDays),
    };
  };

  if (!current) return queued(PAYMENT_PURPOSES.NEW);

  if (String(current.planId) === String(plan._id)) {
    if (scheduled.length >= SUBSCRIPTION_LIMITS.MAX_SCHEDULED) {
      throwError(
        409,
        `You have already renewed this plan. You can renew again after ${formatDate(scheduled[scheduled.length - 1].startDate)}.`
      );
    }
    return queued(PAYMENT_PURPOSES.RENEWAL);
  }

  const currentPrice = toPaise(current.plan.price);
  if (planPrice > currentPrice) {
    if (!settings.allowUpgrade) {
      throwError(
        409,
        `Upgrade is not available right now. You can buy this plan after your current plan ends on ${formatDate(current.endDate)}.`
      );
    }
    const total = current.endDate - current.startDate;
    const remaining = current.endDate - now;
    const credit =
      current.source === SUBSCRIPTION_SOURCES.ADMIN_GRANT || total <= 0
        ? 0
        : Math.floor((currentPrice * remaining) / total);
    const payable = Math.max(
      planPrice - credit,
      PAYMENT_LIMITS.MIN_AMOUNT_PAISE
    );
    return {
      ...base,
      purpose: PAYMENT_PURPOSES.UPGRADE,
      upgradeFromSubscriptionId: current._id,
      // Only the credit actually used (the ₹1 minimum can eat into it)
      creditApplied: planPrice - payable,
      payable,
      startsAt: now,
      endsAt: addDays(now, plan.durationInDays),
    };
  }

  throwError(
    409,
    `You can buy this plan after your current plan ends on ${formatDate(current.endDate)}.`
  );
};

exports.toQuoteView = (quote) => ({
  purpose: quote.purpose,
  planId: quote.planId,
  plan: quote.plan,
  planPrice: quote.planPrice,
  creditApplied: quote.creditApplied,
  payable: quote.payable,
  currency: quote.currency,
  startsAt: quote.startsAt,
  endsAt: quote.endsAt,
  currentSubscriptionId: quote.currentSubscriptionId,
});
