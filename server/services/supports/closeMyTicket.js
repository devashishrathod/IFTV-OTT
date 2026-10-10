const { SUPPORT_STATUSES } = require("../../constants");
const { throwError } = require("../../utils");
const {
  findUserTicket,
  applyStatus,
  toUserView,
} = require("./ticketHelpers");

exports.closeMyTicket = async (userId, id) => {
  const ticket = await findUserTicket(userId, id);
  if (ticket.status === SUPPORT_STATUSES.CLOSED) {
    throwError(400, "Ticket is already closed");
  }
  applyStatus(ticket, SUPPORT_STATUSES.CLOSED);
  await ticket.save();
  return toUserView(ticket);
};
