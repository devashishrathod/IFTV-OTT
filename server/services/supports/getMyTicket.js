const { findUserTicket, toUserView } = require("./ticketHelpers");

exports.getMyTicket = async (userId, id) => {
  const ticket = await findUserTicket(userId, id);
  return toUserView(ticket);
};
