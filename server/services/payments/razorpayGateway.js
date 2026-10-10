const crypto = require("crypto");
const { getRazorpay } = require("../../configs/razorpay");
const { throwError, CustomError } = require("../../utils");

const client = () => {
  const razorpay = getRazorpay();
  if (!razorpay) {
    throwError(503, "Payments are not available right now. Please try again later.");
  }
  return razorpay;
};

// Razorpay SDK errors look like { statusCode, error: { code, description } }
const call = async (fn, message) => {
  try {
    return await fn(client());
  } catch (err) {
    if (err instanceof CustomError) throw err;
    console.error("Razorpay error:", err?.error || err);
    throwError(502, message);
  }
};

const hmac = (secret, data) =>
  crypto.createHmac("sha256", secret).update(data).digest("hex");

const safeEqual = (expected, received) => {
  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(received || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

exports.assertPaymentsConfigured = () => client();

exports.getKeyId = () => process.env.RAZORPAY_KEY_ID;

exports.createRazorpayOrder = (order) =>
  call((rp) => rp.orders.create(order), "Could not start the payment. Please try again.");

exports.fetchRazorpayPayment = (paymentId) =>
  call((rp) => rp.payments.fetch(paymentId), "Could not check the payment with Razorpay. Please try again.");

exports.captureRazorpayPayment = (paymentId, amount, currency) =>
  call((rp) => rp.payments.capture(paymentId, amount, currency), "Could not capture the payment. Please try again.");

exports.fetchRazorpayOrderPayments = (orderId) =>
  call((rp) => rp.orders.fetchPayments(orderId), "Could not check the order with Razorpay. Please try again.");

// Checkout success signature: HMAC_SHA256(order_id|payment_id, key secret)
exports.isValidPaymentSignature = (orderId, paymentId, signature) => {
  client();
  return safeEqual(
    hmac(process.env.RAZORPAY_SECRET, `${orderId}|${paymentId}`),
    signature
  );
};

// Webhook signature: HMAC_SHA256(raw body, webhook secret)
exports.isValidWebhookSignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throwError(503, "Webhook is not configured");
  return safeEqual(hmac(secret, rawBody), signature);
};
