const Joi = require("joi");
const objectId = require("./validJoiObjectId");
const { throwError } = require("../utils");
const { STREAM_MAX_DURATION_SECONDS } = require("../constants");

const LIST_FIELDS = ["casts", "languages"];

/**
 * Multipart forms send lists in different shapes. Normalize them all to an
 * array: `languages[]=a&languages[]=b`, `languages=["a","b"]`, `languages=a,b`.
 */
const normalizeListFields = (data) => {
  const body = { ...(data || {}) };
  LIST_FIELDS.forEach((field) => {
    const bracketKey = `${field}[]`;
    if (body[bracketKey] !== undefined) {
      if (body[field] === undefined) body[field] = body[bracketKey];
      delete body[bracketKey];
    }
    const value = body[field];
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) body[field] = parsed;
      } catch (e) {
        // leave as-is; Joi will report it
      }
    } else if (trimmed.includes(",")) {
      body[field] = trimmed
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  });
  return body;
};

exports.validateCreateMovie = (data) => {
  data = normalizeListFields(data);
  const schema = Joi.object({
    title: Joi.string().min(3).max(120).required().messages({
      "string.min": "Title has minimum {#limit} characters",
      "string.max": "Title cannot exceed {#limit} characters",
    }),
    description: Joi.string().allow("").max(500).messages({
      "string.max": "Description cannot exceed {#limit} characters",
    }),
    casts: Joi.alternatives()
      .optional()
      .try(
        Joi.array().items(Joi.string().min(3).max(120)).required(),
        Joi.string()
          .min(3)
          .max(120)
          .custom((value) => [value]),
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
        Joi.array().items(Joi.string().min(2).max(120)).min(1).required(),
        Joi.string()
          .min(2)
          .max(120)
          .custom((value) => [value]),
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
    videoUrl: Joi.string().uri().optional(),
    videoUid: Joi.string()
      .pattern(/^[a-f0-9]{32}$/)
      .optional()
      .messages({ "string.pattern.base": "Invalid videoUid" }),
    isActive: Joi.boolean().optional(),
  }).oxor("videoUid", "videoUrl");
  return schema.validate(data, { abortEarly: false });
};

exports.validateUpdateMovie = (data) => {
  data = normalizeListFields(data);
  const schema = Joi.object({
    title: Joi.string().min(3).max(120).optional().messages({
      "string.min": "Title must have at least {#limit} characters",
      "string.max": "Title cannot exceed {#limit} characters",
    }),
    description: Joi.string().allow("").max(500).optional().messages({
      "string.max": "Description cannot exceed {#limit} characters",
    }),
    casts: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().min(3).max(120)).optional(),
        Joi.string()
          .min(3)
          .max(120)
          .custom((value) => [value]),
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
      .try(
        Joi.array().items(Joi.string().min(2).max(120)).min(1).optional(),
        Joi.string()
          .min(2)
          .max(120)
          .custom((value) => [value]),
      )
      .custom((value) => {
        if (typeof value === "string") return [value];
        if (Array.isArray(value)) return value;
        if (value && !Array.isArray(value))
          throwError(422, "Languages must be an array or string");
      })
      .messages({
        "string.min": "Language name must have at least {#limit} characters",
        "string.max": "Language name cannot exceed {#limit} characters",
        "array.base": "Languages must be an array or string",
      }),
    categoryId: objectId()
      .messages({
        "any.invalid": "Invalid categoryId format",
      })
      .optional(),
    releaseDate: Joi.date().optional(),
    durationInSeconds: Joi.number().min(0).optional().messages({
      "number.min": "Duration in seconds cannot be negative",
    }),
    videoUrl: Joi.string().uri().optional(),
    videoUid: Joi.string()
      .pattern(/^[a-f0-9]{32}$/)
      .optional()
      .messages({ "string.pattern.base": "Invalid videoUid" }),
    isActive: Joi.boolean().optional(),
  }).oxor("videoUid", "videoUrl");
  return schema.validate(data, { abortEarly: false });
};

exports.validateVideoUploadUrl = (data) => {
  const schema = Joi.object({
    fileSize: Joi.number().integer().min(1).required().messages({
      "any.required": "fileSize (in bytes) is required",
    }),
    fileName: Joi.string().max(255).optional(),
    maxDurationSeconds: Joi.number()
      .integer()
      .min(1)
      .max(STREAM_MAX_DURATION_SECONDS)
      .optional(),
  });
  return schema.validate(data || {}, { abortEarly: false });
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
