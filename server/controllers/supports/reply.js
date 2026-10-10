const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { replyToMyTicket } = require("../../services/supports");
const { validateReply } = require("../../validator/supports");

exports.reply = asyncWrapper(async (req, res) => {
  const { error, value } = validateReply(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const files = req.files?.attachments || req.files?.["attachments[]"];
  const result = await replyToMyTicket(req.user, req.params?.id, value, files);
  return sendSuccess(res, 200, "Reply sent successfully", result);
});
