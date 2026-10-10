const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { adminTicketStats } = require("../../services/supports");
const { validateStatsQuery } = require("../../validator/supports");

exports.adminStats = asyncWrapper(async (req, res) => {
  const { error, value } = validateStatsQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await adminTicketStats(value);
  return sendSuccess(res, 200, "Ticket stats fetched successfully", result);
});
