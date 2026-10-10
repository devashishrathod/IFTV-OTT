require("dotenv").config();
const axios = require("axios");
const { throwError } = require("../../utils");
const APIKEY = process.env.TWO_FACTOR_API_KEY;

/**
 * Checks an OTP with 2factor. Returns 2factor's reply: { Status: "Success" }
 * when it matches, otherwise { Status: "Error", Details: "OTP Mismatch" /
 * "OTP Expired" / ... }. 2factor answers those with HTTP 400, so 4xx is a
 * normal answer here, not an error.
 * Errors are logged without the request URL, which contains the API key.
 */
exports.verifyOtpToMobile = async (sessionId, otp) => {
  let response;
  try {
    response = await axios.get(
      `https://2factor.in/API/V1/${APIKEY}/SMS/VERIFY/${encodeURIComponent(sessionId)}/${encodeURIComponent(otp)}`,
      { validateStatus: () => true },
    );
  } catch (error) {
    console.error("2factor verify OTP failed:", error.code || error.message);
    throwError(502, "OTP service is unavailable. Please try again.");
  }
  if (response.status >= 500) {
    console.error("2factor verify OTP failed:", response.status, response.data);
    throwError(502, "OTP service is unavailable. Please try again.");
  }
  return response.data;
};
