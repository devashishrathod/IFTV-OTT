const SubscriptionSetting = require("../../models/SubscriptionSetting");

const KEY = "default";

const toSettingsView = (settings) => ({
  allowUpgrade: Boolean(settings?.allowUpgrade),
  updatedBy: settings?.updatedBy || null,
  updatedAt: settings?.updatedAt || null,
});

/**
 * Reads the settings document, creating it with defaults on first use.
 */
exports.getSubscriptionSettings = async () => {
  const upsert = () =>
    SubscriptionSetting.findOneAndUpdate(
      { key: KEY },
      { $setOnInsert: { key: KEY } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ).lean();
  try {
    return toSettingsView(await upsert());
  } catch (err) {
    // Two first reads at the same time: one insert wins, read it back
    if (err?.code !== 11000) throw err;
    return toSettingsView(await SubscriptionSetting.findOne({ key: KEY }).lean());
  }
};

exports.updateSubscriptionSettings = async (payload, adminId) => {
  const settings = await SubscriptionSetting.findOneAndUpdate(
    { key: KEY },
    { $set: { ...payload, updatedBy: adminId } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  ).lean();
  return toSettingsView(settings);
};
