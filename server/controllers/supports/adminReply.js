const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { adminReplyToTicket } = require("../../services/supports");
const { validateAdminReply } = require("../../validator/supports");

exports.adminReply = asyncWrapper(async (req, res) => {
  const { error, value } = validateAdminReply(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const files = req.files?.attachments || req.files?.["attachments[]"];
  const result = await adminReplyToTicket(
    req.user,
    req.params?.id,
    value,
    files,
  );
  return sendSuccess(res, 200, "Reply sent successfully", result);
});
