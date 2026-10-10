const mongoose = require("mongoose");
const { userField } = require("./validObjectId");

// Single document (key "default") with admin controlled subscription settings.
const subscriptionSettingSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    allowUpgrade: { type: Boolean, default: false },
    updatedBy: { ...userField },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model(
  "SubscriptionSetting",
  subscriptionSettingSchema
);
