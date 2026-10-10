const mongoose = require("mongoose");
const {
  PLATFORMS,
  USER_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_SOURCES,
  SUBSCRIPTION_LIMITS,
} = require("../constants");
const {
  userField,
  subscriptionField,
  userSubscriptionField,
  paymentField,
} = require("./validObjectId");
const planSnapshot = require("./planSnapshot");

/**
 * One subscription period of a user. Access is decided by the dates
 * (startDate <= now < endDate) of an active / scheduled period, never by the
 * status alone, so a late status sync can't give or take away access.
 * Amounts are in paise.
 */
const userSubscriptionSchema = new mongoose.Schema(
  {
    userId: { ...userField, required: true },
    planId: { ...subscriptionField, required: true },
    plan: { type: planSnapshot, required: true },
    status: {
      type: String,
      enum: [...Object.values(USER_SUBSCRIPTION_STATUSES)],
      required: true,
    },
    source: {
      type: String,
      enum: [...Object.values(SUBSCRIPTION_SOURCES)],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    // When an upgrade / cancel ended this period before endDate
    endedAt: { type: Date },
    paymentId: { ...paymentField },
    amountPaid: { type: Number, default: 0, min: 0 },
    creditApplied: { type: Number, default: 0, min: 0 },
    previousSubscriptionId: { ...userSubscriptionField },
    // Reserved for Razorpay auto-renew (not used yet)
    autoRenew: { type: Boolean, default: false },
    cancelledAt: { type: Date },
    cancelledBy: { ...userField },
    cancelReason: {
      type: String,
      trim: true,
      maxlength: SUBSCRIPTION_LIMITS.MAX_NOTE_LENGTH,
    },
    grantedBy: { ...userField },
    note: {
      type: String,
      trim: true,
      maxlength: SUBSCRIPTION_LIMITS.MAX_NOTE_LENGTH,
    },
    platform: { type: String, enum: [...Object.values(PLATFORMS)] },
    // Reminder days already mailed for this period, e.g. [3, 1]
    remindersSent: { type: [Number], default: [] },
  },
  { timestamps: true, versionKey: false }
);

userSubscriptionSchema.index({ userId: 1, status: 1, endDate: -1 });
userSubscriptionSchema.index({ status: 1, endDate: 1 });
userSubscriptionSchema.index({ status: 1, startDate: 1 });
// One subscription per payment, even if verify and webhook race
userSubscriptionSchema.index(
  { paymentId: 1 },
  { unique: true, partialFilterExpression: { paymentId: { $type: "objectId" } } }
);

module.exports = mongoose.model("UserSubscription", userSubscriptionSchema);
