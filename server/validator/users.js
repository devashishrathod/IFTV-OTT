const Joi = require("joi");
const objectId = require("./validJoiObjectId");
const { ROLES, LOGIN_TYPES } = require("../constants");

exports.validateUpdateUser = (data) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(100).messages({
      "string.min": "Name should have at least {#limit} characters",
      "string.max": "Name should not exceed {#limit} characters",
    }),
    address: Joi.string().allow("").max(300).messages({
      "string.max": "Address cannot exceed {#limit} characters",
    }),
    dob: Joi.date().iso().messages({
      "date.format":
        "Date of birth must be a valid date in ISO format (YYYY-MM-DD)",
    }),
    email: Joi.string().email().messages({
      "string.email": "Please enter a valid email address",
    }),
    mobile: Joi.number().integer().min(1000000000).max(9999999999).messages({
      "number.base": "Mobile number must be numeric",
      "number.min": "Mobile number must be 10 digits",
      "number.max": "Mobile number must be 10 digits",
    }),
  });
  return schema.validate(data, { abortEarly: false });
};

// Text filters accept "" (an empty search box) and ignore it.
const textFilter = Joi.string().trim().allow("").max(100).optional();

exports.validateGetAllUsersQuery = (query) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    role: Joi.string()
      .valid(...Object.values(ROLES), "all")
      .optional(),
    search: textFilter,
    name: textFilter,
    email: textFilter,
    mobile: Joi.string()
      .trim()
      .allow("")
      .pattern(/^\d+$/)
      .max(15)
      .optional()
      .messages({ "string.pattern.base": "Mobile must contain only digits" }),
    loginType: Joi.string()
      .valid(...Object.values(LOGIN_TYPES))
      .optional(),
    currentScreen: textFilter,
    isActive: Joi.boolean().optional(),
    isEmailVerified: Joi.boolean().optional(),
    isMobileVerified: Joi.boolean().optional(),
    isSignUpCompleted: Joi.boolean().optional(),
    isOnBoardingCompleted: Joi.boolean().optional(),
    isLoggedIn: Joi.boolean().optional(),
    isOnline: Joi.boolean().optional(),
    isSubscribed: Joi.boolean().optional(),
    planId: objectId().optional().messages({
      "any.invalid": "Invalid planId format",
    }),
    fromDate: Joi.date().iso().optional(),
    toDate: Joi.date().iso().optional(),
    lastActivityFrom: Joi.date().iso().optional(),
    lastActivityTo: Joi.date().iso().optional(),
    sortBy: Joi.string()
      .valid("createdAt", "updatedAt", "lastActivity", "name", "email")
      .optional(),
    sortOrder: Joi.string().valid("asc", "desc").optional(),
  })
    .custom((value, helpers) => {
      // planId means "current plan is X", so it can't match unsubscribed users
      if (value.planId && value.isSubscribed === false) {
        return helpers.message("planId cannot be used with isSubscribed=false");
      }
      return value;
    });
  return schema.validate(query, { abortEarly: false });
};
