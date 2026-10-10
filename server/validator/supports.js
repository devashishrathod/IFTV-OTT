const Joi = require("joi");
const objectId = require("./validJoiObjectId");
const { isValidPhoneNumber } = require("./common");
const {
  PLATFORMS,
  SUPPORT_SOURCES,
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  SUPPORT_PRIORITIES,
  SUPPORT_LIMITS,
} = require("../constants");

const categories = Object.values(SUPPORT_CATEGORIES);
const statuses = Object.values(SUPPORT_STATUSES);

const subject = Joi.string()
  .trim()
  .min(3)
  .max(SUPPORT_LIMITS.MAX_SUBJECT_LENGTH)
  .required()
  .messages({
    "string.min": "Subject has minimum {#limit} characters",
    "string.max": "Subject cannot exceed {#limit} characters",
  });

const message = Joi.string()
  .trim()
  .min(1)
  .max(SUPPORT_LIMITS.MAX_MESSAGE_LENGTH)
  .required()
  .messages({
    "string.max": "Message cannot exceed {#limit} characters",
  });

const category = Joi.string()
  .valid(...categories)
  .required();

const paginationQuery = {
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
};

const dateRangeQuery = {
  fromDate: Joi.date().iso().optional(),
  toDate: Joi.date().iso().optional(),
};

exports.validateContactUs = (data) => {
  const contactUsSchema = Joi.object({
    name: Joi.string().trim().min(2).max(80).required().messages({
      "string.min": "Name has minimum {#limit} characters",
      "string.max": "Name cannot exceed {#limit} characters",
    }),
    email: Joi.string().trim().email().max(120).required(),
    mobile: Joi.string()
      .trim()
      .allow("")
      .optional()
      .custom((value, helpers) => {
        if (value && !isValidPhoneNumber(value)) {
          return helpers.message("Mobile is not a valid mobile number");
        }
        return value;
      }),
    category,
    subject,
    message: message.min(10).messages({
      "string.min": "Message has minimum {#limit} characters",
    }),
    // Honeypot: hidden on the web form, only bots fill it
    website: Joi.string().allow("").optional(),
  });
  return contactUsSchema.validate(data, { abortEarly: false });
};

exports.validateCreateTicket = (data) => {
  const createSchema = Joi.object({
    category,
    subject,
    message: message.min(10).messages({
      "string.min": "Message has minimum {#limit} characters",
    }),
    platform: Joi.string()
      .valid(...Object.values(PLATFORMS))
      .required(),
    appVersion: Joi.string().trim().max(30).allow("").optional(),
  });
  return createSchema.validate(data, { abortEarly: false });
};

exports.validateReply = (data) => {
  const replySchema = Joi.object({ message });
  return replySchema.validate(data, { abortEarly: false });
};

exports.validateGetMyTicketsQuery = (payload) => {
  const getMyQuerySchema = Joi.object({
    ...paginationQuery,
    status: Joi.string()
      .valid(...statuses)
      .optional(),
  });
  return getMyQuerySchema.validate(payload, { abortEarly: false });
};

exports.validateAdminGetAllQuery = (payload) => {
  const getAllQuerySchema = Joi.object({
    ...paginationQuery,
    ...dateRangeQuery,
    source: Joi.string()
      .valid(...Object.values(SUPPORT_SOURCES))
      .optional(),
    status: Joi.string()
      .valid(...statuses)
      .optional(),
    category: Joi.string()
      .valid(...categories)
      .optional(),
    priority: Joi.string()
      .valid(...Object.values(SUPPORT_PRIORITIES))
      .optional(),
    platform: Joi.string()
      .valid(...Object.values(PLATFORMS))
      .optional(),
    assignedTo: objectId().optional().messages({
      "any.invalid": "Invalid assignedTo format",
    }),
    search: Joi.string().trim().max(100).optional(),
    sortBy: Joi.string()
      .valid("createdAt", "updatedAt", "lastReplyAt")
      .optional(),
    sortOrder: Joi.string().valid("asc", "desc").optional(),
  });
  return getAllQuerySchema.validate(payload, { abortEarly: false });
};

exports.validateAdminReply = (data) => {
  const adminReplySchema = Joi.object({
    message,
    status: Joi.string()
      .valid(...statuses)
      .optional(),
  });
  return adminReplySchema.validate(data, { abortEarly: false });
};

exports.validateAdminUpdate = (data) => {
  const adminUpdateSchema = Joi.object({
    status: Joi.string()
      .valid(...statuses)
      .optional(),
    priority: Joi.string()
      .valid(...Object.values(SUPPORT_PRIORITIES))
      .optional(),
    // null unassigns the ticket
    assignedTo: objectId().allow(null).optional().messages({
      "any.invalid": "Invalid assignedTo format",
    }),
    adminNote: Joi.string()
      .trim()
      .allow("")
      .max(SUPPORT_LIMITS.MAX_MESSAGE_LENGTH)
      .optional(),
  })
    .min(1)
    .messages({ "object.min": "Nothing to update" });
  return adminUpdateSchema.validate(data, { abortEarly: false });
};

exports.validateStatsQuery = (payload) => {
  const statsQuerySchema = Joi.object({ ...dateRangeQuery });
  return statsQuerySchema.validate(payload, { abortEarly: false });
};
