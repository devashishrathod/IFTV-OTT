const { asyncWrapper, sendSuccess } = require("../../utils");
const { adminDeleteTicket } = require("../../services/supports");

exports.adminDelete = asyncWrapper(async (req, res) => {
  await adminDeleteTicket(req.params?.id);
  return sendSuccess(res, 200, "Ticket deleted successfully");
});
