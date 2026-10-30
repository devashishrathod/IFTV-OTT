const Joi = require("joi");
const objectId = require("./validJoiObjectId");
const {
  PLATFORMS,
  DASHBOARD_RANGES,
  DASHBOARD_GROUP_BY,
  DASHBOARD_LIMITS,
} = require("../constants");

const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

// A calendar day in IST, e.g. 2026-10-01 (no time part)
const calendarDay = Joi.string()
  .trim()
  .pattern(DAY_FORMAT)
  .custom((value, helpers) => {
    // A wrong format is already reported by pattern()
    if (!DAY_FORMAT.test(value)) return value;
    const date = new Date(`${value}T00:00:00Z`);
    if (isNaN(date) || date.toISOString().slice(0, 10) !== value) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .messages({
    "string.pattern.base": "{#label} must be a date in YYYY-MM-DD format",
    "any.invalid": "{#label} is not a valid date",
  });

exports.validateDashboardQuery = (query) => {
  const schema = Joi.object({
    range: Joi.string()
      .valid(...Object.values(DASHBOARD_RANGES))
      .optional(),
    fromDate: calendarDay.optional(),
    toDate: calendarDay.optional(),
    groupBy: Joi.string()
      .valid(...Object.values(DASHBOARD_GROUP_BY))
      .optional(),
    platform: Joi.string()
      .valid(...Object.values(PLATFORMS))
      .optional(),
    planId: objectId().optional().messages({
      "any.invalid": "Invalid planId format",
    }),
    categoryId: objectId().optional().messages({
      "any.invalid": "Invalid categoryId format",
    }),
    compare: Joi.boolean().optional(),
    recentLimit: Joi.number()
      .integer()
      .min(1)
      .max(DASHBOARD_LIMITS.MAX_RECENT_LIMIT)
      .optional(),
  }).custom((value, helpers) => {
    const hasDates = Boolean(value.fromDate || value.toDate);
    // Dates without a range mean a custom range
    const range =
      value.range ||
      (hasDates ? DASHBOARD_RANGES.CUSTOM : DASHBOARD_LIMITS.DEFAULT_RANGE);
    if (range !== DASHBOARD_RANGES.CUSTOM && hasDates) {
      return helpers.message(
        "fromDate and toDate can only be used with range=custom"
      );
    }
    if (range === DASHBOARD_RANGES.CUSTOM && !value.fromDate) {
      return helpers.message("fromDate is required when range is custom");
    }
    if (value.fromDate && value.toDate && value.toDate < value.fromDate) {
      return helpers.message("toDate cannot be before fromDate");
    }
    return { ...value, range };
  });
  return schema.validate(query, { abortEarly: false });
};
