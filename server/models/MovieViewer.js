const mongoose = require("mongoose");
const { MOVIE_VIEWER_TYPES, PLATFORMS } = require("../constants");
const { movieField, userField } = require("./validObjectId");

/**
 * One row per movie per viewer, all time. The unique index makes the repeat
 * window check and "first time" (unique viewer / player) atomic.
 */
const movieViewerSchema = new mongoose.Schema(
  {
    movieId: { ...movieField, required: true },
    // user:<userId> for a logged-in viewer, device:<deviceId> for a guest
    viewerKey: { type: String, required: true },
    userId: { ...userField, default: null },
    deviceId: { type: String, default: null },
    viewerType: {
      type: String,
      enum: [...Object.values(MOVIE_VIEWER_TYPES)],
      default: MOVIE_VIEWER_TYPES.GUEST,
    },
    platform: {
      type: String,
      enum: [...Object.values(PLATFORMS), null],
      default: null,
    },
    views: { type: Number, default: 0 },
    plays: { type: Number, default: 0 },
    lastViewedAt: { type: Date, default: null },
    lastPlayedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

movieViewerSchema.index({ movieId: 1, viewerKey: 1 }, { unique: true });

module.exports = mongoose.model("MovieViewer", movieViewerSchema);
