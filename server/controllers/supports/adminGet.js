const { asyncWrapper, sendSuccess } = require("../../utils");
const { adminGetTicket } = require("../../services/supports");

exports.adminGet = asyncWrapper(async (req, res) => {
  const ticket = await adminGetTicket(req.params?.id);
  return sendSuccess(res, 200, "Ticket fetched successfully", ticket);
});
