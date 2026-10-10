const { escapeHtml, sendSupportMail } = require("./supportMailLayout");

// Acknowledgement to the person who raised the ticket / Contact Us query.
exports.sendSupportTicketCreatedMail = (ticket) => {
  sendSupportMail({
    to: ticket.email,
    subject: `We received your request [${ticket.ticketId}]`,
    heading: "We've got your request",
    body: `
      <p style="font-size: 16px; color: #333;">
        Hi ${escapeHtml(ticket.name || "there")}, <br><br>
        Thanks for reaching out to IFTV-OTT support. Our team will get back to you soon.
      </p>
      <p style="font-size: 14px; color: #555;">
        <strong>Ticket number:</strong> ${escapeHtml(ticket.ticketId)}<br>
        <strong>Subject:</strong> ${escapeHtml(ticket.subject)}
      </p>
      <p style="font-size: 14px; color: #888;">
        Please mention your ticket number if you contact us again about this.
      </p>
    `,
  });
};
