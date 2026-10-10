const { asyncWrapper, sendSuccess } = require("../../utils");
const { getMyTicket } = require("../../services/supports");

exports.get = asyncWrapper(async (req, res) => {
  const ticket = await getMyTicket(req.userId, req.params?.id);
  return sendSuccess(res, 200, "Ticket fetched successfully", ticket);
});
