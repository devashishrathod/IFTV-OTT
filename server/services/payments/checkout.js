const Payment = require("../../models/Payment");
const {
  PLATFORMS,
  PAYMENT_STATUSES,
  PAYMENT_LIMITS,
} = require("../../constants");
const { throwError } = require("../../utils");
const {
  findPurchasablePlan,
  getOpenPeriods,
  toUserSubscriptionView,
} = require("../subscriptions/periods");
const { getSubscriptionSettings } = require("../subscriptions/settings");
const { buildQuote, toQuoteView } = require("../subscriptions/quote");
const {
  assertPaymentsConfigured,
  getKeyId,
  createRazorpayOrder,
  fetchRazorpayPayment,
  isValidPaymentSignature,
} = require("./razorpayGateway");
const {
  generateUniqueReceipt,
  toUserPaymentView,
  ensureCaptured,
} = require("./paymentHelpers");
const { activatePayment } = require("./activatePayment");

const ORDER_EXPIRY_MS = PAYMENT_LIMITS.ORDER_EXPIRY_MINUTES * 60 * 1000;

const quoteFor = async (userId, planId, now = new Date()) => {
  const plan = await findPurchasablePlan(planId);
  const [periods, settings] = await Promise.all([
    getOpenPeriods(userId, now),
    getSubscriptionSettings(),
  ]);
  return { plan, quote: buildQuote({ plan, periods, settings, now }) };
};

/**
 * Price breakdown before buying (new / renewal / upgrade).
 */
exports.getQuote = async (userId, { planId }) => {
  const { quote } = await quoteFor(userId, planId);
  return toQuoteView(quote);
};

/**
 * Creates a Razorpay order for a plan. The amount always comes from the
 * server-side quote; the client only says which plan.
 */
exports.createOrder = async (user, { planId, platform }) => {
  if (platform === PLATFORMS.IOS) {
    throwError(
      403,
      "Plans can't be bought in the iOS app. Please buy your plan on the IFTV-OTT website."
    );
  }
  assertPaymentsConfigured();
  const now = new Date();
  const { plan, quote } = await quoteFor(user._id, planId, now);

  // One open order per user: a new attempt replaces the old one. If the old
  // one still gets paid, activation accepts expired orders too.
  await Payment.updateMany(
    { userId: user._id, status: PAYMENT_STATUSES.CREATED },
    { $set: { status: PAYMENT_STATUSES.EXPIRED } }
  );

  const receipt = await generateUniqueReceipt();
  const order = await createRazorpayOrder({
    amount: quote.payable,
    currency: quote.currency,
    receipt,
    notes: {
      userId: String(user._id),
      planId: String(plan._id),
      purpose: quote.purpose,
    },
  });
  const payment = await Payment.create({
    userId: user._id,
    planId: plan._id,
    plan: quote.plan,
    purpose: quote.purpose,
    upgradeFromSubscriptionId: quote.upgradeFromSubscriptionId,
    amount: quote.payable,
    planPrice: quote.planPrice,
    creditApplied: quote.creditApplied,
    currency: quote.currency,
    receipt,
    razorpayOrderId: order.id,
    expiresAt: new Date(now.getTime() + ORDER_EXPIRY_MS),
    platform,
  });

  return {
    payment: toUserPaymentView(payment),
    quote: toQuoteView(quote),
    // Pass straight to Razorpay Checkout (web checkout.js / Android SDK)
    checkout: {
      key: getKeyId(),
      order_id: order.id,
      amount: payment.amount,
      currency: payment.currency,
      name: "IFTV-OTT",
      description: `${plan.name} (${plan.type})`,
      prefill: {
        name: user.name || "",
        email: user.email || "",
        contact: user.mobile ? String(user.mobile) : "",
      },
      notes: { receipt },
    },
  };
};

const toResult = ({ payment, subscription, alreadyProcessed }) => ({
  alreadyProcessed,
  payment: payment ? toUserPaymentView(payment) : null,
  subscription: subscription ? toUserSubscriptionView(subscription) : null,
});

/**
 * Called by web / app after Razorpay Checkout succeeds.
 */
exports.verifyPayment = async (user, body) => {
  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: rpPaymentId,
    razorpay_signature: signature,
  } = body;
  const payment = await Payment.findOne({
    razorpayOrderId: orderId,
    userId: user._id,
  });
  if (!payment) throwError(404, "Payment not found");
  if (!isValidPaymentSignature(orderId, rpPaymentId, signature)) {
    throwError(
      400,
      "Payment verification failed. If money was deducted, your plan will be activated automatically in a few minutes."
    );
  }
  if (payment.status === PAYMENT_STATUSES.PAID) {
    if (payment.razorpayPaymentId !== rpPaymentId) {
      throwError(409, "This order is already paid");
    }
    return toResult(await activatePayment(payment._id, { id: rpPaymentId }));
  }
  const rpPayment = await fetchRazorpayPayment(rpPaymentId);
  const captured = await ensureCaptured(rpPayment, payment);
  if (!captured) {
    throwError(
      402,
      "Payment is not complete yet. If money was deducted, your plan will be activated automatically in a few minutes."
    );
  }
  return toResult(
    await activatePayment(payment._id, captured, { signature })
  );
};

/**
 * Web / app reports a closed or failed checkout. A paid order is never
 * touched.
 */
exports.markPaymentFailed = async (user, { razorpay_order_id: orderId, reason }) => {
  const payment = await Payment.findOneAndUpdate(
    {
      razorpayOrderId: orderId,
      userId: user._id,
      status: PAYMENT_STATUSES.CREATED,
    },
    {
      $set: {
        status: PAYMENT_STATUSES.FAILED,
        failureReason: reason || "Checkout closed",
      },
    },
    { returnDocument: "after" }
  );
  if (payment) return toUserPaymentView(payment);
  const existing = await Payment.findOne({
    razorpayOrderId: orderId,
    userId: user._id,
  });
  if (!existing) throwError(404, "Payment not found");
  return toUserPaymentView(existing);
};
