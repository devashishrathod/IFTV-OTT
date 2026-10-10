const { escapeHtml, sendSupportMail } = require("./supportMailLayout");

const formatDate = (date) =>
  new Date(date).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const formatRupees = (paise) => `₹${(paise / 100).toFixed(2)}`;

// Receipt mail after a successful subscription payment.
exports.sendPaymentSuccessMail = (user, payment, period) => {
  sendSupportMail({
    to: user?.email,
    subject: `Payment successful [${payment.receipt}]`,
    heading: "Your plan is confirmed",
    body: `
      <p style="font-size: 16px; color: #333;">
        Hi ${escapeHtml(user?.name || "there")}, <br><br>
        Thanks for subscribing to IFTV-OTT.
      </p>
      <p style="font-size: 14px; color: #555;">
        <strong>Plan:</strong> ${escapeHtml(payment.plan.name)}<br>
        <strong>Amount paid:</strong> ${formatRupees(payment.amount)}${payment.creditApplied ? ` (upgrade credit ${formatRupees(payment.creditApplied)})` : ""}<br>
        <strong>Valid:</strong> ${formatDate(period.startDate)} to ${formatDate(period.endDate)}<br>
        <strong>Receipt:</strong> ${escapeHtml(payment.receipt)}
      </p>
      <p style="font-size: 14px; color: #888;">
        You can see your plan and payments in the IFTV-OTT app or website.
      </p>
    `,
  });
};
