const SupportTicket = require("../../models/SupportTicket");
const {
  SUPPORT_SOURCES,
  SUPPORT_STATUSES,
  SUPPORT_LIMITS,
} = require("../../constants");
const {
  sendSupportTicketCreatedMail,
  sendSupportAdminAlertMail,
} = require("../../helpers/nodeMailer");
const { throwError } = require("../../utils");
const {
  assertAttachments,
  uploadAttachments,
  deleteAttachments,
} = require("./attachments");
const { createWithTicketId, toUserView } = require("./ticketHelpers");

exports.createTicket = async (user, payload, files) => {
  assertAttachments(files);
  const openCount = await SupportTicket.countDocuments({
    user: user._id,
    source: SUPPORT_SOURCES.TICKET,
    status: { $ne: SUPPORT_STATUSES.CLOSED },
    isDeleted: false,
  });
  if (openCount >= SUPPORT_LIMITS.MAX_OPEN_TICKETS_PER_USER) {
    throwError(
      429,
      `You already have ${SUPPORT_LIMITS.MAX_OPEN_TICKETS_PER_USER} open tickets. Please close one or wait for them to be resolved.`,
    );
  }
  const attachments = await uploadAttachments(files);
  let ticket;
  try {
    ticket = await createWithTicketId({
      ...payload,
      appVersion: payload.appVersion || undefined,
      source: SUPPORT_SOURCES.TICKET,
      user: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile ? String(user.mobile) : undefined,
      attachments,
    });
  } catch (err) {
    await deleteAttachments(attachments);
    throw err;
  }
  sendSupportTicketCreatedMail(ticket);
  sendSupportAdminAlertMail(ticket);
  return toUserView(ticket);
};
