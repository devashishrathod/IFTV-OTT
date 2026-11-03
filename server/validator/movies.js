const Joi = require("joi");
const objectId = require("./validJoiObjectId");
const { throwError } = require("../utils");
const {
  STREAM_MAX_DURATION_SECONDS,
  MOVIE_ACCESS_TYPES,
  SUBSCRIPTION_LIMITS,
  PLATFORMS,
  DASHBOARD_GROUP_BY,
  MOVIE_EVENTS,
  MOVIE_VIEWER_TYPES,
  MOVIE_STATS_LIMITS,
} = require("../constants");
const { rangeKeys, resolveRange } = require("./dashboard");
const { LEADERBOARD_SORT_FIELDS } = require("../services/movies/movieLeaderboard");
const { VIEWER_SORT_FIELDS } = require("../services/movies/movieViewers");

const LIST_FIELDS = ["casts", "languages", "allowedPlans"];

const accessType = Joi.string()
  .valid(...Object.values(MOVIE_ACCESS_TYPES))
  .optional();

// Plans that include a paid movie. Multipart may send one id or a list;
// an empty value clears the list (see normalizeListFields).
const allowedPlans = Joi.alternatives()
  .try(
    Joi.array()
      .items(objectId())
      .max(SUBSCRIPTION_LIMITS.MAX_PLAN_LINKS_PER_MOVIE),
    objectId().custom((value) => [value])
  )
  .optional()
  .messages({ "alternatives.match": "allowedPlans must be a list of plan ids" });

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
    // An empty allowedPlans clears the list
    if (field === "allowedPlans" && trimmed === "") {
      body[field] = [];
      return;
    }
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
    accessType,
    allowedPlans,
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
    accessType,
    allowedPlans,
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
    // Any movie field, or views / plays / trending
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid("asc", "desc").optional(),
    accessType,
  });
  return getAllQuerySchema.validate(payload, { abortEarly: false });
};

const platform = Joi.string()
  .valid(...Object.values(PLATFORMS))
  .optional();

const sortOrder = Joi.string().valid("asc", "desc").optional();

const statsPage = {
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(MOVIE_STATS_LIMITS.MAX_PAGE_LIMIT).optional(),
};

exports.validateTrackMovie = (data) => {
  const schema = Joi.object({
    event: Joi.string()
      .valid(...Object.values(MOVIE_EVENTS))
      .required(),
    platform,
    // Required for guests (checked in the service); logged-in users may skip it
    deviceId: Joi.string()
      .trim()
      .max(MOVIE_STATS_LIMITS.MAX_DEVICE_ID_LENGTH)
      .pattern(/^[A-Za-z0-9._:-]+$/)
      .optional()
      .messages({
        "string.pattern.base":
          "deviceId may only contain letters, numbers and . _ : -",
      }),
  });
  return schema.validate(data || {}, { abortEarly: false });
};

exports.validateMovieStatsQuery = (query) => {
  const schema = Joi.object({
    ...rangeKeys,
    groupBy: Joi.string()
      .valid(...Object.values(DASHBOARD_GROUP_BY))
      .optional(),
    platform,
    compare: Joi.boolean().optional(),
  }).custom(resolveRange);
  return schema.validate(query, { abortEarly: false });
};

exports.validateMoviesLeaderboardQuery = (query) => {
  const schema = Joi.object({
    ...rangeKeys,
    ...statsPage,
    platform,
    categoryId: objectId().optional().messages({
      "any.invalid": "Invalid categoryId format",
    }),
    accessType,
    isActive: Joi.boolean().optional(),
    search: Joi.string().trim().max(120).optional(),
    sortBy: Joi.string()
      .valid(...LEADERBOARD_SORT_FIELDS)
      .optional(),
    sortOrder,
  }).custom(resolveRange);
  return schema.validate(query, { abortEarly: false });
};

exports.validateMovieViewersQuery = (query) => {
  const schema = Joi.object({
    ...rangeKeys,
    ...statsPage,
    platform,
    viewerType: Joi.string()
      .valid(...Object.values(MOVIE_VIEWER_TYPES))
      .optional(),
    sortBy: Joi.string()
      .valid(...VIEWER_SORT_FIELDS)
      .optional(),
    sortOrder,
  }).custom(resolveRange);
  return schema.validate(query, { abortEarly: false });
};
