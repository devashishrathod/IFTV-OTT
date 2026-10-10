const { SUPPORT_STATUSES } = require("../../constants");
const { sendSupportReplyMail } = require("../../helpers/nodeMailer");
const { throwError } = require("../../utils");
const { uploadAttachments, deleteAttachments } = require("./attachments");
const { findTicket, applyStatus } = require("./ticketHelpers");
const { adminGetTicket } = require("./adminGetTicket");

exports.adminReplyToTicket = async (agent, id, payload, files) => {
  const ticket = await findTicket(id);
  if (ticket.status === SUPPORT_STATUSES.CLOSED) {
    throwError(400, "This ticket is closed. Reopen it before replying.");
  }
  const attachments = await uploadAttachments(files);
  ticket.replies.push({
    sender: agent._id,
    senderRole: agent.role,
    message: payload.message,
    attachments,
  });
  ticket.lastReplyAt = new Date();
  // The first answer moves a new ticket to in_progress unless a status is given.
  const nextStatus =
    payload.status ||
    (ticket.status === SUPPORT_STATUSES.OPEN
      ? SUPPORT_STATUSES.IN_PROGRESS
      : undefined);
  const statusChanged = applyStatus(ticket, nextStatus);
  try {
    await ticket.save();
  } catch (err) {
    await deleteAttachments(attachments);
    throw err;
  }
  sendSupportReplyMail(ticket, {
    message: payload.message,
    isResolved: statusChanged && ticket.status === SUPPORT_STATUSES.RESOLVED,
  });
  return await adminGetTicket(id);
};
