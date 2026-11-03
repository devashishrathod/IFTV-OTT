const mongoose = require("mongoose");
const { MOVIE_VIEWER_TYPES, PLATFORMS } = require("../constants");
const { movieField, userField } = require("./validObjectId");

/**
 * Counted views / plays of one viewer on one movie, per IST day and platform.
 * Date range stats, charts and circles are built from these rows.
 */
const movieActivitySchema = new mongoose.Schema(
  {
    movieId: { ...movieField, required: true },
    // Same key as MovieViewer: user:<userId> or device:<deviceId>
    viewerKey: { type: String, required: true },
    // IST midnight of the day
    day: { type: Date, required: true },
    platform: {
      type: String,
      enum: [...Object.values(PLATFORMS), null],
      default: null,
    },
    userId: { ...userField, default: null },
    viewerType: {
      type: String,
      enum: [...Object.values(MOVIE_VIEWER_TYPES)],
      default: MOVIE_VIEWER_TYPES.GUEST,
    },
    views: { type: Number, default: 0 },
    plays: { type: Number, default: 0 },
    lastViewedAt: { type: Date, default: null },
    lastPlayedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

movieActivitySchema.index(
  { movieId: 1, viewerKey: 1, day: 1, platform: 1 },
  { unique: true }
);
movieActivitySchema.index({ movieId: 1, day: 1 });
movieActivitySchema.index({ day: 1 });

module.exports = mongoose.model("MovieActivity", movieActivitySchema);
