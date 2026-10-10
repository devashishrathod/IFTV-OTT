const { escapeHtml, sendSupportMail } = require("./supportMailLayout");

const formatDate = (date) =>
  new Date(date).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// "Your plan ends soon" mail, sent a few days before the period ends.
exports.sendSubscriptionReminderMail = (user, period, days) => {
  sendSupportMail({
    to: user?.email,
    subject: `Your IFTV-OTT plan ends in ${days} day${days === 1 ? "" : "s"}`,
    heading: "Your plan ends soon",
    body: `
      <p style="font-size: 16px; color: #333;">
        Hi ${escapeHtml(user?.name || "there")}, <br><br>
        Your <strong>${escapeHtml(period.plan.name)}</strong> plan ends on
        <strong>${formatDate(period.endDate)}</strong>.
      </p>
      <p style="font-size: 14px; color: #888;">
        Renew from the IFTV-OTT website or app to keep watching without a break.
      </p>
    `,
  });
};
