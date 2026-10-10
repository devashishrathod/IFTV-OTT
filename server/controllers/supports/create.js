const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { createTicket } = require("../../services/supports");
const { validateCreateTicket } = require("../../validator/supports");

exports.create = asyncWrapper(async (req, res) => {
  const { error, value } = validateCreateTicket(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const files = req.files?.attachments || req.files?.["attachments[]"];
  const result = await createTicket(req.user, value, files);
  return sendSuccess(res, 201, "Ticket created successfully", result);
});
