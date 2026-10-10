const Joi = require("joi");
const objectId = require("./validJoiObjectId");
const {
  PLATFORMS,
  SUBSCRIPTION_TYPES,
  USER_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_SOURCES,
  SUBSCRIPTION_LIMITS,
} = require("../constants");

const paginationQuery = {
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
};

const dateRangeQuery = {
  fromDate: Joi.date().iso().optional(),
  toDate: Joi.date().iso().optional(),
};

const planFields = {
  sortOrder: Joi.number().integer().optional(),
  isPopular: Joi.boolean().optional(),
};

exports.validateCreateSubscription = (data) => {
  const createSchema = Joi.object({
    name: Joi.string().trim().min(3).max(120).required().messages({
      "string.min": "Name has minimum {#limit} characters",
      "string.max": "Name cannot exceed {#limit} characters",
    }),
    description: Joi.string().allow("").max(500).messages({
      "string.max": "Description cannot exceed {#limit} characters",
    }),
    price: Joi.number().min(0).required().messages({
      "string.min": "Price must be at least {#limit}",
      "any.required": "Price is required",
    }),
    type: Joi.string()
      .valid(...Object.values(SUBSCRIPTION_TYPES))
      .required(),
    // Accepted for old clients but ignored: the server sets it from `type`
    durationInDays: Joi.number().optional(),
    benefits: Joi.array().items(Joi.string()).optional(),
    limitations: Joi.array().items(Joi.string()).optional(),
    isActive: Joi.boolean().optional(),
    ...planFields,
  });
  return createSchema.validate(data);
};

exports.validateUpdateSubscription = (data) => {
  const updateSchema = Joi.object({
    name: Joi.string().trim().min(3).max(120).optional().messages({
      "string.min": "Name has minimum {#limit} characters",
      "string.max": "Name cannot exceed {#limit} characters",
    }),
    description: Joi.string().allow("").max(500).optional().messages({
      "string.max": "Description cannot exceed {#limit} characters",
    }),
    price: Joi.number().min(0).optional(),
    type: Joi.string()
      .valid(...Object.values(SUBSCRIPTION_TYPES))
      .optional(),
    benefits: Joi.array().items(Joi.string()).optional(),
    limitations: Joi.array().items(Joi.string()).optional(),
    isActive: Joi.boolean().optional(),
    ...planFields,
  })
    .min(1)
    .messages({ "object.min": "Nothing to update" });
  return updateSchema.validate(data, { abortEarly: false });
};

exports.validateGetAllSubscriptionQueries = (query) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow(""),
    price: Joi.number().min(0),
    minPrice: Joi.number().min(0),
    maxPrice: Joi.number().min(0),
    fromDate: Joi.date().iso(),
    toDate: Joi.date().iso(),
    name: Joi.string().trim(),
    type: Joi.string().valid(...Object.values(SUBSCRIPTION_TYPES)),
    isActive: Joi.boolean(),
  })
    .custom((value, helpers) => {
      if (
        value.minPrice !== undefined &&
        value.maxPrice !== undefined &&
        value.minPrice > value.maxPrice
      ) {
        return helpers.message(
          "minPrice must be less than or equal to maxPrice"
        );
      }
      return value;
    })
    .unknown(true);
  return schema.validate(query, { abortEarly: false });
};

exports.validateHistoryQuery = (query) => {
  const schema = Joi.object({ ...paginationQuery });
  return schema.validate(query, { abortEarly: false });
};

exports.validateAdminUserSubscriptionsQuery = (query) => {
  const schema = Joi.object({
    ...paginationQuery,
    ...dateRangeQuery,
    status: Joi.string()
      .valid(...Object.values(USER_SUBSCRIPTION_STATUSES))
      .optional(),
    planId: objectId().optional().messages({ "any.invalid": "Invalid planId format" }),
    userId: objectId().optional().messages({ "any.invalid": "Invalid userId format" }),
    source: Joi.string()
      .valid(...Object.values(SUBSCRIPTION_SOURCES))
      .optional(),
    platform: Joi.string()
      .valid(...Object.values(PLATFORMS))
      .optional(),
    search: Joi.string().trim().max(100).optional(),
    sortBy: Joi.string().valid("createdAt", "startDate", "endDate").optional(),
    sortOrder: Joi.string().valid("asc", "desc").optional(),
  });
  return schema.validate(query, { abortEarly: false });
};

exports.validateGrantSubscription = (data) => {
  const schema = Joi.object({
    userId: objectId().required().messages({ "any.invalid": "Invalid userId format" }),
    planId: objectId().required().messages({ "any.invalid": "Invalid planId format" }),
    days: Joi.number()
      .integer()
      .min(1)
      .max(SUBSCRIPTION_LIMITS.MAX_GRANT_DAYS)
      .optional(),
    note: Joi.string()
      .trim()
      .allow("")
      .max(SUBSCRIPTION_LIMITS.MAX_NOTE_LENGTH)
      .optional(),
  });
  return schema.validate(data || {}, { abortEarly: false });
};

exports.validateCancelSubscription = (data) => {
  const schema = Joi.object({
    reason: Joi.string()
      .trim()
      .allow("")
      .max(SUBSCRIPTION_LIMITS.MAX_NOTE_LENGTH)
      .optional(),
  });
  return schema.validate(data || {}, { abortEarly: false });
};

exports.validateSettings = (data) => {
  const schema = Joi.object({
    allowUpgrade: Joi.boolean().required(),
  });
  return schema.validate(data || {}, { abortEarly: false });
};
