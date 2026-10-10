const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { adminGetAllTickets } = require("../../services/supports");
const { validateAdminGetAllQuery } = require("../../validator/supports");

exports.adminGetAll = asyncWrapper(async (req, res) => {
  const { error } = validateAdminGetAllQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await adminGetAllTickets(req.query);
  return sendSuccess(res, 200, "Tickets fetched successfully", result);
});
