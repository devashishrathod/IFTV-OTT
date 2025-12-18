const Joi = require("joi");
const { SUBSCRIPTION_TYPES } = require("../constants");

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
    durationInDays: Joi.number().optional(),
    benefits: Joi.array().items(Joi.string()).optional(),
    limitations: Joi.array().items(Joi.string()).optional(),
    isActive: Joi.boolean().optional(),
  });
  return createSchema.validate(data);
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
