const SupportTicket = require("../../models/SupportTicket");
const { throwError, validateObjectId } = require("../../utils");

exports.adminGetTicket = async (id) => {
  validateObjectId(id, "Ticket Id");
  const ticket = await SupportTicket.findOne({ _id: id, isDeleted: false })
    .populate("user", "name email mobile image")
    .populate("assignedTo", "name email role")
    .populate("replies.sender", "name role");
  if (!ticket) throwError(404, "Ticket not found");
  return ticket;
};
