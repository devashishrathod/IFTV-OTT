require("dotenv").config();
const axios = require("axios");
const { throwError } = require("../../utils");
const APIKEY = process.env.TWO_FACTOR_API_KEY;

/**
 * Sends an OTP SMS through 2factor. Returns 2factor's reply
 * ({ Status: "Success", Details: <sessionId> }).
 * Errors are logged without the request URL, which contains the API key.
 */
exports.sendOtpToMobile = async (mobile) => {
  let response;
  try {
    response = await axios.get(
      `https://2factor.in/API/V1/${APIKEY}/SMS/${mobile}/AUTOGEN`,
      { validateStatus: () => true },
    );
  } catch (error) {
    console.error("2factor send OTP failed:", mobile, error.code || error.message);
    throwError(502, "OTP service is unavailable. Please try again.");
  }
  if (response.status >= 500) {
    console.error("2factor send OTP failed:", mobile, response.status, response.data);
    throwError(502, "OTP service is unavailable. Please try again.");
  }
  if (response.data?.Status !== "Success" || !response.data?.Details) {
    console.error("2factor send OTP rejected:", mobile, response.status, response.data);
    throwError(400, "Could not send OTP to this mobile number");
  }
  console.log(`OTP sent to ${mobile}`);
  return response.data;
};
