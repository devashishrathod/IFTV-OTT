const mongoose = require("mongoose");
const {
  PLATFORMS,
  PAYMENT_PURPOSES,
  PAYMENT_STATUSES,
  PAYMENT_PROVIDERS,
  PAYMENT_LIMITS,
} = require("../constants");
const {
  userField,
  subscriptionField,
  userSubscriptionField,
} = require("./validObjectId");
const planSnapshot = require("./planSnapshot");

/**
 * One purchase attempt (a Razorpay order). The quote (purpose, price, credit,
 * payable) is fixed when the order is created, so later admin changes never
 * change what a paid order activates. Amounts are in paise.
 */
const paymentSchema = new mongoose.Schema(
  {
    userId: { ...userField, required: true },
    planId: { ...subscriptionField, required: true },
    plan: { type: planSnapshot, required: true },
    userSubscriptionId: { ...userSubscriptionField },
    purpose: {
      type: String,
      enum: [...Object.values(PAYMENT_PURPOSES)],
      required: true,
    },
    // Upgrade only: the period being replaced
    upgradeFromSubscriptionId: { ...userSubscriptionField },
    provider: {
      type: String,
      enum: [...Object.values(PAYMENT_PROVIDERS)],
      default: PAYMENT_PROVIDERS.RAZORPAY,
    },
    amount: { type: Number, required: true, min: 0 },
    planPrice: { type: Number, required: true, min: 0 },
    creditApplied: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: PAYMENT_LIMITS.CURRENCY },
    status: {
      type: String,
      enum: [...Object.values(PAYMENT_STATUSES)],
      default: PAYMENT_STATUSES.CREATED,
    },
    receipt: { type: String, required: true, unique: true },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    method: { type: String },
    failureReason: {
      type: String,
      trim: true,
      maxlength: PAYMENT_LIMITS.MAX_FAILURE_REASON_LENGTH,
    },
    paidAt: { type: Date },
    expiresAt: { type: Date },
    platform: { type: String, enum: [...Object.values(PLATFORMS)] },
  },
  { timestamps: true, versionKey: false }
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ status: 1, paidAt: -1 });
paymentSchema.index(
  { razorpayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: { razorpayPaymentId: { $type: "string" } },
  }
);

module.exports = mongoose.model("Payment", paymentSchema);
