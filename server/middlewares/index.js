const { errorHandler } = require("./errorHandler");
const { cleanupTempFiles } = require("./cleanupTempFiles");
const { generateJwtToken } = require("./generateJwtToken");
const { verifyJwtToken } = require("./verifyJwtToken");
const { validateRoles, isAdmin, isUser, isStaff } = require("./validateRoles");
const { optionalAuth } = require("./optionalAuth");

module.exports = {
  errorHandler,
  cleanupTempFiles,
  generateJwtToken,
  verifyJwtToken,
  optionalAuth,
  validateRoles,
  isAdmin,
  isUser,
  isStaff,
};
