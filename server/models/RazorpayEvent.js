const mongoose = require("mongoose");

// Log of Razorpay webhook deliveries. The unique eventId stops a retried
// delivery from being processed twice.
const razorpayEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    event: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed },
    processedAt: { type: Date },
    error: { type: String },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("RazorpayEvent", razorpayEventSchema);
