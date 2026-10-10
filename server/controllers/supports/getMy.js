const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { getMyTickets } = require("../../services/supports");
const { validateGetMyTicketsQuery } = require("../../validator/supports");

exports.getMy = asyncWrapper(async (req, res) => {
  const { error } = validateGetMyTicketsQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await getMyTickets(req.userId, req.query);
  return sendSuccess(res, 200, "Tickets fetched successfully", result);
});
