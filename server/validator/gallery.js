const Joi = require("joi");
const objectId = require("./validJoiObjectId");
const { GALLERY_MEDIA_TYPES, GALLERY_LIMITS } = require("../constants");

/**
 * Multipart forms send tags in different shapes. Normalize them all to an
 * array: `tags[]=a&tags[]=b`, `tags=["a","b"]`, `tags=a,b`, `tags=a`.
 * An empty `tags=` clears the tags.
 */
const normalizeTags = (data) => {
  const body = { ...(data || {}) };
  if (body["tags[]"] !== undefined) {
    if (body.tags === undefined) body.tags = body["tags[]"];
    delete body["tags[]"];
  }
  if (typeof body.tags !== "string") return body;
  const trimmed = body.tags.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) body.tags = parsed;
    } catch (e) {
      // leave as-is; Joi will report it
    }
  } else {
    body.tags = trimmed
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return body;
};

const title = Joi.string()
  .trim()
  .allow("")
  .max(GALLERY_LIMITS.MAX_TITLE_LENGTH)
  .messages({ "string.max": "Title cannot exceed {#limit} characters" });

const description = Joi.string()
  .trim()
  .allow("")
  .max(GALLERY_LIMITS.MAX_DESCRIPTION_LENGTH)
  .messages({ "string.max": "Description cannot exceed {#limit} characters" });

const tags = Joi.array()
  .items(
    Joi.string()
      .trim()
      .lowercase()
      .min(1)
      .max(GALLERY_LIMITS.MAX_TAG_LENGTH)
      .messages({ "string.max": "Tag cannot exceed {#limit} characters" }),
  )
  .max(GALLERY_LIMITS.MAX_TAGS)
  .messages({
    "array.max": "Maximum {#limit} tags are allowed",
    "array.base": "Tags must be an array or a comma separated string",
  });

const order = Joi.number().integer().min(0).max(1000000).messages({
  "number.base": "Order must be a number",
  "number.min": "Order cannot be negative",
});

const videoUid = Joi.string()
  .pattern(/^[a-f0-9]{32}$/)
  .messages({ "string.pattern.base": "Invalid videoUid" });

const mediaType = Joi.string().valid(...Object.values(GALLERY_MEDIA_TYPES));

const dateRangeQuery = {
  fromDate: Joi.date().iso().optional(),
  toDate: Joi.date().iso().optional(),
};

exports.validateCreateGalleryItem = (data) => {
  const createSchema = Joi.object({
    title: title.optional(),
    description: description.optional(),
    tags: tags.optional(),
    order: order.optional(),
    isActive: Joi.boolean().optional(),
    videoUid: videoUid.optional(),
  });
  return createSchema.validate(normalizeTags(data), { abortEarly: false });
};

exports.validateBulkCreateGalleryItems = (data) => {
  const bulkCreateSchema = Joi.object({
    tags: tags.optional(),
    isActive: Joi.boolean().optional(),
  });
  return bulkCreateSchema.validate(normalizeTags(data), { abortEarly: false });
};

exports.validateUpdateGalleryItem = (data) => {
  const updateSchema = Joi.object({
    title: title.optional(),
    description: description.optional(),
    tags: tags.optional(),
    order: order.optional(),
    isActive: Joi.boolean().optional(),
    videoUid: videoUid.optional(),
    removePoster: Joi.boolean().optional(),
  });
  return updateSchema.validate(normalizeTags(data), { abortEarly: false });
};

exports.validateReorderGalleryItems = (data) => {
  const reorderSchema = Joi.object({
    items: Joi.array()
      .items(
        Joi.object({
          id: objectId().required().messages({
            "any.invalid": "Invalid gallery item id",
          }),
          order: order.required(),
        }),
      )
      .min(1)
      .max(GALLERY_LIMITS.MAX_REORDER_ITEMS)
      .unique("id")
      .required()
      .messages({
        "array.min": "Send at least one item",
        "array.max": "Maximum {#limit} items can be reordered at once",
        "array.unique": "Each gallery item can appear only once",
      }),
  });
  return reorderSchema.validate(data || {}, { abortEarly: false });
};

exports.validateGetAllGalleryQuery = (payload) => {
  const getAllQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(GALLERY_LIMITS.MAX_PAGE_LIMIT)
      .optional(),
    mediaType: mediaType.optional(),
    tag: Joi.string().trim().max(GALLERY_LIMITS.MAX_TAG_LENGTH).optional(),
    search: Joi.string().trim().max(100).optional(),
  });
  return getAllQuerySchema.validate(payload, { abortEarly: false });
};

exports.validateAdminGetAllGalleryQuery = (payload) => {
  const adminGetAllQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(GALLERY_LIMITS.MAX_ADMIN_PAGE_LIMIT)
      .optional(),
    ...dateRangeQuery,
    mediaType: mediaType.optional(),
    isActive: Joi.boolean().optional(),
    tag: Joi.string().trim().max(GALLERY_LIMITS.MAX_TAG_LENGTH).optional(),
    search: Joi.string().trim().max(100).optional(),
    sortBy: Joi.string().valid("order", "createdAt", "updatedAt").optional(),
    sortOrder: Joi.string().valid("asc", "desc").optional(),
  });
  return adminGetAllQuerySchema.validate(payload, { abortEarly: false });
};
