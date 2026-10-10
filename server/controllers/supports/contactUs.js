const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { createContactUs } = require("../../services/supports");
const { validateContactUs } = require("../../validator/supports");

exports.contactUs = asyncWrapper(async (req, res) => {
  const { error, value } = validateContactUs(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const result = await createContactUs(value);
  return sendSuccess(res, 201, "Your message has been sent successfully", result);
});
