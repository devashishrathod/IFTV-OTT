const SupportTicket = require("../../models/SupportTicket");
const {
  PLATFORMS,
  SUPPORT_SOURCES,
  SUPPORT_STATUSES,
  SUPPORT_LIMITS,
} = require("../../constants");
const { generateTicketId } = require("../../helpers/supports");
const {
  sendSupportTicketCreatedMail,
  sendSupportAdminAlertMail,
} = require("../../helpers/nodeMailer");
const { throwError } = require("../../utils");
const { createWithTicketId } = require("./ticketHelpers");

const DAY_MS = 24 * 60 * 60 * 1000;

exports.createContactUs = async (payload) => {
  const { website, ...data } = payload;
  // Honeypot filled in: a bot. Answer like a success so it learns nothing.
  if (website) {
    return { ticketId: generateTicketId(), status: SUPPORT_STATUSES.OPEN };
  }
  const email = data.email.toLowerCase();
  const recentCount = await SupportTicket.countDocuments({
    source: SUPPORT_SOURCES.CONTACT_US,
    email,
    createdAt: { $gte: new Date(Date.now() - DAY_MS) },
  });
  if (recentCount >= SUPPORT_LIMITS.MAX_CONTACT_US_PER_EMAIL_PER_DAY) {
    throwError(
      429,
      "Too many requests from this email. Please try again after 24 hours.",
    );
  }
  const ticket = await createWithTicketId({
    ...data,
    email,
    mobile: data.mobile || undefined,
    source: SUPPORT_SOURCES.CONTACT_US,
    platform: PLATFORMS.WEB,
  });
  sendSupportTicketCreatedMail(ticket);
  sendSupportAdminAlertMail(ticket);
  return {
    ticketId: ticket.ticketId,
    status: ticket.status,
    createdAt: ticket.createdAt,
  };
};
