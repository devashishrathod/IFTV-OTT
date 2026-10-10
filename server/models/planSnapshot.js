const mongoose = require("mongoose");

// Copy of a plan at the time of purchase, so later price / name changes by the
// admin never change a user's history. `price` is in rupees like the plan.
module.exports = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    price: { type: Number, required: true },
    durationInDays: { type: Number, required: true },
    benefits: { type: [String], default: [] },
  },
  { _id: false }
);
