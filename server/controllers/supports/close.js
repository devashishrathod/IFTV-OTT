const { asyncWrapper, sendSuccess } = require("../../utils");
const { closeMyTicket } = require("../../services/supports");

exports.close = asyncWrapper(async (req, res) => {
  const result = await closeMyTicket(req.userId, req.params?.id);
  return sendSuccess(res, 200, "Ticket closed successfully", result);
});
