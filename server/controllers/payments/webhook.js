const { asyncWrapper, sendSuccess } = require("../../utils");
const { handleWebhook } = require("../../services/payments");

// Razorpay only. Signature is checked on the raw body (see index.js).
exports.webhook = asyncWrapper(async (req, res) => {
  const result = await handleWebhook({
    rawBody: req.rawBody,
    signature: req.headers["x-razorpay-signature"],
    eventId: req.headers["x-razorpay-event-id"],
    body: req.body,
  });
  return sendSuccess(res, 200, "Webhook received", result);
});
