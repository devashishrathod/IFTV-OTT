const Joi = require("joi");
const objectId = require("./validJoiObjectId");
const {
  PLATFORMS,
  PAYMENT_STATUSES,
  PAYMENT_PURPOSES,
  PAYMENT_LIMITS,
} = require("../constants");

const paginationQuery = {
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
};

const dateRangeQuery = {
  fromDate: Joi.date().iso().optional(),
  toDate: Joi.date().iso().optional(),
};

const planId = objectId()
  .required()
  .messages({ "any.invalid": "Invalid planId format" });

const razorpayId = (prefix) =>
  Joi.string()
    .trim()
    .max(64)
    .pattern(new RegExp(`^${prefix}_[A-Za-z0-9]+$`))
    .required()
    .messages({ "string.pattern.base": `Invalid {#label}` });

exports.validateQuote = (query) => {
  const schema = Joi.object({ planId });
  return schema.validate(query || {}, { abortEarly: false });
};

exports.validateCreateOrder = (data) => {
  const schema = Joi.object({
    planId,
    platform: Joi.string()
      .valid(...Object.values(PLATFORMS))
      .required(),
  });
  return schema.validate(data || {}, { abortEarly: false });
};

exports.validateVerifyPayment = (data) => {
  const schema = Joi.object({
    razorpay_order_id: razorpayId("order"),
    razorpay_payment_id: razorpayId("pay"),
    razorpay_signature: Joi.string()
      .trim()
      .pattern(/^[a-f0-9]{64}$/)
      .required()
      .messages({ "string.pattern.base": "Invalid razorpay_signature" }),
  });
  return schema.validate(data || {}, { abortEarly: false });
};

exports.validatePaymentFailed = (data) => {
  const schema = Joi.object({
    razorpay_order_id: razorpayId("order"),
    reason: Joi.string()
      .trim()
      .allow("")
      .max(PAYMENT_LIMITS.MAX_FAILURE_REASON_LENGTH)
      .optional(),
  });
  return schema.validate(data || {}, { abortEarly: false });
};

exports.validateMyPaymentsQuery = (query) => {
  const schema = Joi.object({
    ...paginationQuery,
    status: Joi.string()
      .valid(...Object.values(PAYMENT_STATUSES))
      .optional(),
  });
  return schema.validate(query, { abortEarly: false });
};

exports.validateAdminPaymentsQuery = (query) => {
  const schema = Joi.object({
    ...paginationQuery,
    ...dateRangeQuery,
    status: Joi.string()
      .valid(...Object.values(PAYMENT_STATUSES))
      .optional(),
    purpose: Joi.string()
      .valid(...Object.values(PAYMENT_PURPOSES))
      .optional(),
    planId: objectId().optional().messages({ "any.invalid": "Invalid planId format" }),
    userId: objectId().optional().messages({ "any.invalid": "Invalid userId format" }),
    method: Joi.string().trim().max(30).optional(),
    platform: Joi.string()
      .valid(...Object.values(PLATFORMS))
      .optional(),
    search: Joi.string().trim().max(100).optional(),
    sortBy: Joi.string().valid("createdAt", "paidAt", "amount").optional(),
    sortOrder: Joi.string().valid("asc", "desc").optional(),
  });
  return schema.validate(query, { abortEarly: false });
};

exports.validateStatsQuery = (query) => {
  const schema = Joi.object({ ...dateRangeQuery });
  return schema.validate(query, { abortEarly: false });
};
