const mongoose = require("mongoose");
const { DEFAULT_IMAGES, MOVIE_ACCESS_TYPES } = require("../constants");
const { categoryField, subscriptionField } = require("./validObjectId");

const movieSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    casts: {
      type: [String],
      required: true,
      trim: true,
      set: (arr) => [...new Set(arr.map((a) => a.trim()))],
    },
    languages: {
      type: [String],
      required: true,
      trim: true,
      set: (arr) => [...new Set(arr.map((a) => a.trim()))],
    },
    categoryId: categoryField,
    releaseDate: { type: Date },
    durationInSeconds: { type: Number },
    video: { type: String, default: null },
    image: { type: String, default: DEFAULT_IMAGES.MOVIE },
    // Movies saved before this field existed have no value and count as free
    accessType: {
      type: String,
      enum: [...Object.values(MOVIE_ACCESS_TYPES)],
      default: MOVIE_ACCESS_TYPES.FREE,
    },
    // Paid movies only: plans that include it. Empty = any active plan.
    allowedPlans: { type: [{ ...subscriptionField }], default: [] },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("Movie", movieSchema);
