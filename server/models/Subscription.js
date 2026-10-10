const mongoose = require("mongoose");
const { SUBSCRIPTION_TYPES, PAYMENT_LIMITS } = require("../constants");

const subscriptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    // Rupees, GST included. Users pay exactly this (minus upgrade credit).
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: PAYMENT_LIMITS.CURRENCY },
    type: {
      type: String,
      enum: Object.values(SUBSCRIPTION_TYPES),
      required: true,
    },
    durationInDays: { type: Number },
    benefits: { type: [String], default: [] },
    limitations: { type: [String], default: [] },
    // Display order on web / app plan screens (ascending)
    sortOrder: { type: Number, default: 0 },
    isPopular: { type: Boolean, default: false },
    // Reserved for Razorpay auto-renew (not used yet)
    razorpayPlanId: { type: String },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
