const { SUPPORT_SOURCES } = require("../../constants");
const { escapeHtml, multiline, sendSupportMail } = require("./supportMailLayout");

const PREVIEW_LENGTH = 500;

// Tells the support team (NODEMAILER_EMAIL) that a new ticket came in.
exports.sendSupportAdminAlertMail = (ticket) => {
  const source =
    ticket.source === SUPPORT_SOURCES.CONTACT_US ? "Contact Us" : "Ticket";
  const preview =
    ticket.message.length > PREVIEW_LENGTH
      ? `${ticket.message.slice(0, PREVIEW_LENGTH)}…`
      : ticket.message;
  sendSupportMail({
    to: process.env.NODEMAILER_EMAIL,
    subject: `New ${source} [${ticket.ticketId}]: ${ticket.subject}`,
    heading: `New ${source}`,
    body: `
      <p style="font-size: 14px; color: #555;">
        <strong>Ticket number:</strong> ${escapeHtml(ticket.ticketId)}<br>
        <strong>Category:</strong> ${escapeHtml(ticket.category)}<br>
        <strong>Platform:</strong> ${escapeHtml(ticket.platform)}<br>
        <strong>From:</strong> ${escapeHtml(ticket.name || "-")} (${escapeHtml(ticket.email || "no email")}${ticket.mobile ? `, ${escapeHtml(ticket.mobile)}` : ""})<br>
        <strong>Attachments:</strong> ${ticket.attachments?.length || 0}
      </p>
      <p style="font-size: 14px; color: #333;"><strong>${escapeHtml(ticket.subject)}</strong></p>
      <p style="font-size: 14px; color: #333;">${multiline(preview)}</p>
    `,
  });
};
