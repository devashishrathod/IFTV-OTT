const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { asyncWrapper } = require("../utils");

/**
 * For public APIs that show more to a logged-in user (e.g. unlocked movies).
 * A valid token sets req.user like verifyJwtToken; a missing, expired or bad
 * token just means "guest", so the API keeps working exactly as before.
 */
exports.optionalAuth = asyncWrapper(async (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return next();
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return next();
  }
  const user = await User.findOne({ _id: decoded?.id, isDeleted: false })
    .select("-password -otp -isDeleted")
    .catch(() => null);
  if (user) {
    req.userId = user._id;
    req.role = user.role;
    req.user = user;
  }
  next();
});
