const Razorpay = require("razorpay");

let instance = null;

/**
 * Razorpay client, created on first use. Returns null while the keys are not
 * set, so the server still starts (and non-payment APIs work) without them.
 */
exports.getRazorpay = () => {
  if (instance) return instance;
  const { RAZORPAY_KEY_ID, RAZORPAY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_SECRET) return null;
  instance = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_SECRET,
  });
  return instance;
};
