const crypto = require("crypto");
const Payment = require("../../models/Payment");
const { throwError, validateObjectId } = require("../../utils");
const {
  captureRazorpayPayment,
  fetchRazorpayPayment,
} = require("./razorpayGateway");

const MAX_RECEIPT_ATTEMPTS = 5;

/**
 * Human readable receipt number: IFTV-YYMMDD-XXXXXX (date in IST + 6 random
 * digits), e.g. IFTV-261010-482193. Checked against existing payments; the
 * unique index catches the rare race.
 */
const generateReceipt = () => {
  const date = new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
    .slice(2)
    .replace(/-/g, "");
  return `IFTV-${date}-${crypto.randomInt(100000, 1000000)}`;
};

exports.generateUniqueReceipt = async () => {
  for (let attempt = 1; ; attempt++) {
    const receipt = generateReceipt();
    if (!(await Payment.exists({ receipt })) || attempt >= MAX_RECEIPT_ATTEMPTS) {
      return receipt;
    }
  }
};

/**
 * What a user sees of their own payment: no signature or internal links.
 */
exports.toUserPaymentView = (payment) => {
  const {
    razorpaySignature,
    upgradeFromSubscriptionId,
    provider,
    ...view
  } = payment.toObject ? payment.toObject() : payment;
  return view;
};

exports.findUserPayment = async (userId, id) => {
  validateObjectId(id, "Payment Id");
  const payment = await Payment.findOne({ _id: id, userId });
  if (!payment) throwError(404, "Payment not found");
  return payment;
};

/**
 * Checks a Razorpay payment really belongs to our order and is for the right
 * amount, capturing it if it's only authorized. Returns the captured payment,
 * or null when it isn't captured (yet).
 */
exports.ensureCaptured = async (rpPayment, payment) => {
  if (rpPayment?.order_id !== payment.razorpayOrderId) {
    throwError(400, "This payment does not belong to the order");
  }
  if (
    Number(rpPayment.amount) !== payment.amount ||
    rpPayment.currency !== payment.currency
  ) {
    throwError(400, "Payment amount does not match the order");
  }
  let captured = rpPayment;
  if (captured.status === "authorized") {
    try {
      captured = await captureRazorpayPayment(
        captured.id,
        payment.amount,
        payment.currency
      );
    } catch (err) {
      // Auto-capture (or the webhook) may have captured it in the meantime
      captured = await fetchRazorpayPayment(rpPayment.id);
      if (captured?.status !== "captured") throw err;
    }
  }
  return captured?.status === "captured" ? captured : null;
};
