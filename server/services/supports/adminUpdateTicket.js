const User = require("../../models/User");
const { ROLES, SUPPORT_STATUSES } = require("../../constants");
const { sendSupportReplyMail } = require("../../helpers/nodeMailer");
const { throwError } = require("../../utils");
const { findTicket, applyStatus } = require("./ticketHelpers");
const { adminGetTicket } = require("./adminGetTicket");

exports.adminUpdateTicket = async (id, payload) => {
  const ticket = await findTicket(id);
  const { status, priority, assignedTo, adminNote } = payload;
  if (assignedTo !== undefined) {
    if (assignedTo) {
      const agent = await User.exists({
        _id: assignedTo,
        isDeleted: false,
        role: { $in: [ROLES.ADMIN, ROLES.STAFF] },
      });
      if (!agent) {
        throwError(422, "assignedTo must be an active admin or staff user");
      }
    }
    ticket.assignedTo = assignedTo || null;
  }
  if (priority) ticket.priority = priority;
  if (adminNote !== undefined) ticket.adminNote = adminNote;
  const statusChanged = applyStatus(ticket, status);
  await ticket.save();
  if (statusChanged && ticket.status === SUPPORT_STATUSES.RESOLVED) {
    sendSupportReplyMail(ticket, { isResolved: true });
  }
  return await adminGetTicket(id);
};
