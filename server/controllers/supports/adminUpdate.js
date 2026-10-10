const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { adminUpdateTicket } = require("../../services/supports");
const { validateAdminUpdate } = require("../../validator/supports");

exports.adminUpdate = asyncWrapper(async (req, res) => {
  const { error, value } = validateAdminUpdate(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const result = await adminUpdateTicket(req.params?.id, value);
  return sendSuccess(res, 200, "Ticket updated successfully", result);
});
