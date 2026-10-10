const crypto = require("crypto");
const Payment = require("../../models/Payment");
const RazorpayEvent = require("../../models/RazorpayEvent");
const { PAYMENT_STATUSES, PAYMENT_LIMITS } = require("../../constants");
const { throwError, CustomError } = require("../../utils");
const { isValidWebhookSignature } = require("./razorpayGateway");
const { ensureCaptured } = require("./paymentHelpers");
const { activatePayment } = require("./activatePayment");

const SUCCESS_EVENTS = ["payment.authorized", "payment.captured", "order.paid"];

/**
 * Handles one event. Returns a note when the event can't be used (unknown
 * order, amount mismatch, ...): those are logged, not retried. Throws only
 * for errors worth a Razorpay retry (database / gateway trouble).
 */
const processEvent = async (event, body) => {
  const entity = body?.payload?.payment?.entity;
  if (SUCCESS_EVENTS.includes(event)) {
    if (!entity?.order_id) return "No payment in event";
    const payment = await Payment.findOne({ razorpayOrderId: entity.order_id });
    if (!payment) return `Unknown order ${entity.order_id}`;
    if (payment.status === PAYMENT_STATUSES.PAID) return undefined;
    let captured;
    try {
      captured = await ensureCaptured(entity, payment);
    } catch (err) {
      if (err instanceof CustomError && err.statusCode === 400) return err.message;
      throw err;
    }
    if (!captured) return `Payment ${entity.id} is ${entity.status}`;
    await activatePayment(payment._id, captured);
    return undefined;
  }
  if (event === "payment.failed") {
    if (!entity?.order_id) return "No payment in event";
    await Payment.updateOne(
      { razorpayOrderId: entity.order_id, status: PAYMENT_STATUSES.CREATED },
      {
        $set: {
          status: PAYMENT_STATUSES.FAILED,
          method: entity.method,
          failureReason: String(
            entity.error_description || "Payment failed"
          ).slice(0, PAYMENT_LIMITS.MAX_FAILURE_REASON_LENGTH),
        },
      }
    );
    return undefined;
  }
  return `Ignored event ${event}`;
};

/**
 * Razorpay webhook. The signature is checked on the raw body; every event is
 * stored once (by event id) so a retried delivery is not processed twice.
 */
exports.handleWebhook = async ({ rawBody, signature, eventId, body }) => {
  if (!rawBody || !isValidWebhookSignature(rawBody, signature)) {
    throwError(400, "Invalid webhook signature");
  }
  const event = body?.event;
  if (!event) throwError(400, "Invalid webhook payload");
  const id =
    eventId || crypto.createHash("sha256").update(rawBody).digest("hex");

  let record;
  try {
    record = await RazorpayEvent.create({ eventId: id, event, payload: body });
  } catch (err) {
    if (err?.code !== 11000) throw err;
    record = await RazorpayEvent.findOne({ eventId: id });
    if (record?.processedAt) return { duplicate: true };
  }

  try {
    const note = await processEvent(event, body);
    record.processedAt = new Date();
    record.error = note;
    await record.save();
    return { processed: true };
  } catch (err) {
    record.error = err.message;
    await record.save().catch(() => {});
    throw err;
  }
};
