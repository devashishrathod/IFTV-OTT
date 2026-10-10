const { ROLES, SUPPORT_STATUSES } = require("../../constants");
const { throwError } = require("../../utils");
const { uploadAttachments, deleteAttachments } = require("./attachments");
const {
  findUserTicket,
  applyStatus,
  toUserView,
} = require("./ticketHelpers");

exports.replyToMyTicket = async (user, id, payload, files) => {
  const ticket = await findUserTicket(user._id, id);
  if (ticket.status === SUPPORT_STATUSES.CLOSED) {
    throwError(400, "This ticket is closed. Please create a new ticket.");
  }
  const attachments = await uploadAttachments(files);
  ticket.replies.push({
    sender: user._id,
    senderRole: ROLES.USER,
    message: payload.message,
    attachments,
  });
  ticket.lastReplyAt = new Date();
  // The user says the issue is still there: reopen it.
  if (ticket.status === SUPPORT_STATUSES.RESOLVED) {
    applyStatus(ticket, SUPPORT_STATUSES.OPEN);
  }
  try {
    await ticket.save();
  } catch (err) {
    await deleteAttachments(attachments);
    throw err;
  }
  return toUserView(ticket);
};
