const defaultPassword = process.env.DEFAULT_PASSWORD;
const User = require("../../models/User");
const { ROLES, LOGIN_TYPES } = require("../../constants");
const { asyncWrapper, sendSuccess, throwError } = require("../../utils");
const { sendOtpToMobile } = require("../../helpers/twoFactor");

// Upper bound on our side; 2factor also expires its OTPs.
const MOBILE_OTP_EXPIRY_MS = 10 * 60 * 1000;

exports.loginOrSignInWithMobile = asyncWrapper(async (req, res) => {
  let { mobile, role, loginType } = req.body;
  if (!mobile) throwError(422, "Mobile number is required");
  role = role?.toLowerCase() || ROLES.USER;
  loginType = loginType?.toLowerCase() || LOGIN_TYPES.MOBILE;
  let isFirst = false;
  let user = await User.findOne({ mobile, role, isDeleted: false }).select(
    "+password",
  );
  if (!user) {
    isFirst = true;
    user = await User.create({
      mobile,
      role,
      loginType,
      password: defaultPassword,
    });
  }
  const otpData = await sendOtpToMobile(mobile);
  // Remember which 2factor session belongs to this user, so verify can
  // reject a session/OTP that was sent to a different number.
  user.otp = {
    sessionId: otpData.Details,
    expiresAt: new Date(Date.now() + MOBILE_OTP_EXPIRY_MS),
  };
  await user.save();
  return sendSuccess(
    res,
    200,
    "OTP has been sent to your Mobile. Please check your inbox.",
    {
      otpData,
      isFirst,
    },
  );
});
