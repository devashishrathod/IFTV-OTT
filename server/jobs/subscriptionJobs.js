const cron = require("node-cron");
const UserSubscription = require("../models/UserSubscription");
const Payment = require("../models/Payment");
const User = require("../models/User");
const { PAYMENT_STATUSES, SUBSCRIPTION_LIMITS } = require("../constants");
const { sendSubscriptionReminderMail } = require("../helpers/nodeMailer");
const {
  ENTITLED_STATUSES,
  addDays,
  syncStatuses,
} = require("../services/subscriptions/periods");

const TIMEZONE = "Asia/Kolkata";

/**
 * Keeps stored statuses tidy: ended periods → expired, started scheduled
 * periods → active, unpaid orders past their expiry → expired. Access never
 * waits for this job; it checks the dates itself.
 */
exports.runStatusSync = async () => {
  const now = new Date();
  await syncStatuses({}, now);
  await Payment.updateMany(
    { status: PAYMENT_STATUSES.CREATED, expiresAt: { $lte: now } },
    { $set: { status: PAYMENT_STATUSES.EXPIRED } }
  );
};

/**
 * "Plan ends in N days" mails. Each period gets each reminder at most once
 * (claimed atomically, so two servers can't both send it), and users who
 * already renewed are skipped.
 */
exports.runExpiryReminders = async () => {
  const now = new Date();
  for (const days of SUBSCRIPTION_LIMITS.REMINDER_DAYS) {
    const candidates = await UserSubscription.find({
      status: { $in: ENTITLED_STATUSES },
      startDate: { $lte: now },
      endDate: { $gt: addDays(now, days - 1), $lte: addDays(now, days) },
      remindersSent: { $ne: days },
    })
      .select("_id")
      .lean();
    for (const { _id } of candidates) {
      const period = await UserSubscription.findOneAndUpdate(
        { _id, remindersSent: { $ne: days } },
        { $push: { remindersSent: days } },
        { returnDocument: "after" }
      );
      if (!period) continue;
      const renewed = await UserSubscription.exists({
        _id: { $ne: period._id },
        userId: period.userId,
        status: { $in: ENTITLED_STATUSES },
        endDate: { $gt: period.endDate },
      });
      if (renewed) continue;
      const user = await User.findById(period.userId).select("name email").lean();
      sendSubscriptionReminderMail(user, period, days);
    }
  }
};

const safely = (name, job) => async () => {
  try {
    await job();
  } catch (err) {
    console.error(`⛔ Job ${name} failed:`, err);
  }
};

exports.startSubscriptionJobs = () => {
  cron.schedule("*/15 * * * *", safely("subscription-status-sync", exports.runStatusSync), {
    timezone: TIMEZONE,
    name: "subscription-status-sync",
    noOverlap: true,
  });
  cron.schedule("0 10 * * *", safely("subscription-expiry-reminders", exports.runExpiryReminders), {
    timezone: TIMEZONE,
    name: "subscription-expiry-reminders",
    noOverlap: true,
  });
  console.log("✅ Subscription jobs scheduled");
};
