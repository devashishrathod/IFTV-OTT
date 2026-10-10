const { SUPPORT_SOURCES } = require("../../constants");
const { escapeHtml, multiline, sendSupportMail } = require("./supportMailLayout");

/**
 * Tells the user about an admin reply and/or that the ticket was resolved.
 * For Contact Us (guests) this mail is the only way the answer reaches them.
 */
exports.sendSupportReplyMail = (ticket, { message, isResolved = false } = {}) => {
  if (!message && !isResolved) return;
  const isContactUs = ticket.source === SUPPORT_SOURCES.CONTACT_US;
  const nextStep = isContactUs
    ? "Just reply to this email if you need anything else."
    : isResolved
      ? "If the issue is still there, reply to this ticket in the IFTV-OTT app or website and it will be reopened."
      : "You can see the full conversation and reply in the IFTV-OTT app or website.";
  sendSupportMail({
    to: ticket.email,
    subject: isResolved
      ? `Your request has been resolved [${ticket.ticketId}]`
      : `New reply on your request [${ticket.ticketId}]`,
    heading: isResolved ? "Your request is resolved" : "Our team replied",
    body: `
      <p style="font-size: 16px; color: #333;">
        Hi ${escapeHtml(ticket.name || "there")},
      </p>
      <p style="font-size: 14px; color: #555;">
        <strong>Ticket number:</strong> ${escapeHtml(ticket.ticketId)}<br>
        <strong>Subject:</strong> ${escapeHtml(ticket.subject)}
      </p>
      ${message ? `<div style="font-size: 14px; color: #333; background-color: #fff; padding: 15px; border-radius: 6px; border: 1px solid #e0e0e0;">${multiline(message)}</div>` : ""}
      <p style="font-size: 14px; color: #888;">${nextStep}</p>
    `,
  });
};
