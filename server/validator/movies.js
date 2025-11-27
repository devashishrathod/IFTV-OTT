const Joi = require("joi");
const objectId = require("./validJoiObjectId");
const { throwError } = require("../utils");

exports.validateCreateMovie = (data) => {
  const schema = Joi.object({
    title: Joi.string().min(3).max(120).required().messages({
      "string.min": "Title has minimum {#limit} characters",
      "string.max": "Title cannot exceed {#limit} characters",
    }),
    description: Joi.string().allow("").max(300).messages({
      "string.max": "Description cannot exceed {#limit} characters",
    }),
    casts: Joi.alternatives()
      .optional()
      .try(
        Joi.array().items(Joi.string().min(3).max(120)).required(),
        Joi.string()
          .min(3)
          .max(120)
          .custom((value) => [value])
      )
      .custom((value) => {
        if (typeof value === "string") return [value];
        if (Array.isArray(value)) return value;
        if (value && !Array.isArray(value))
          throwError(422, "Casts must be an array or string");
      })
      .messages({
        "string.min": "Cast name must have at least {#limit} characters",
        "string.max": "Cast name cannot exceed {#limit} characters",
        "array.base": "Casts must be an array or string",
      }),
    languages: Joi.alternatives()
      .required()
      .try(
        Joi.array().items(Joi.string().min(3).max(120)).required(),
        Joi.string()
          .min(3)
          .max(120)
          .custom((value) => [value])
      )
      .custom((value) => {
        if (typeof value === "string") return [value];
        if (Array.isArray(value)) return value;
        if (value && !Array.isArray(value))
          throwError(422, "Languages must be an array or string");
      })
      .messages({
        "any.required": "Languages is required",
        "string.min": "Language name must have at least {#limit} characters",
        "string.max": "Language name cannot exceed {#limit} characters",
        "array.base": "Languages must be an array or string",
      }),
    categoryId: objectId()
      .messages({
        "any.invalid": "Invalid categoryId format",
      })
      .required(),
    releaseDate: Joi.date().optional(),
    durationInSeconds: Joi.number().min(0).optional().messages({
      "number.min": "Duration in seconds cannot be negative",
    }),
    isActive: Joi.boolean().optional(),
  });
  return schema.validate(data, { abortEarly: false });
};

exports.validateGetAllMoviesQuery = (payload) => {
  const getAllQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).optional(),
    search: Joi.string().optional(),
    title: Joi.string().optional(),
    casts: Joi.string().optional(),
    languages: Joi.string().optional(),
    categoryId: objectId().optional(),
    isActive: Joi.alternatives().try(Joi.string(), Joi.boolean()).optional(),
    releaseDate: Joi.date().iso().optional(),
    fromDate: Joi.date().iso().optional(),
    toDate: Joi.date().iso().optional(),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid("asc", "desc").optional(),
  });
  return getAllQuerySchema.validate(payload, { abortEarly: false });
};
