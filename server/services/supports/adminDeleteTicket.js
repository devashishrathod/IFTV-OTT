const { findTicket } = require("./ticketHelpers");

// Soft delete; attachments stay on Cloudflare.
exports.adminDeleteTicket = async (id) => {
  const ticket = await findTicket(id);
  ticket.isDeleted = true;
  await ticket.save();
};
