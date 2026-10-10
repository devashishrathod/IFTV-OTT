const mongoose = require("mongoose");
const { GALLERY_MEDIA_TYPES, GALLERY_LIMITS } = require("../constants");
const { userField } = require("./validObjectId");

const galleryItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      maxlength: GALLERY_LIMITS.MAX_TITLE_LENGTH,
    },
    description: {
      type: String,
      trim: true,
      maxlength: GALLERY_LIMITS.MAX_DESCRIPTION_LENGTH,
    },
    mediaType: {
      type: String,
      enum: [...Object.values(GALLERY_MEDIA_TYPES)],
      required: true,
    },
    // Cloudflare Images URL (image / gif) or Cloudflare Stream watch URL (video)
    media: { type: String, required: true },
    // Video only. Without one, the Stream auto thumbnail is shown instead.
    poster: { type: String, default: null },
    durationInSeconds: { type: Number, default: null },
    tags: {
      type: [String],
      default: [],
      set: (arr) => [
        ...new Set((arr || []).map((t) => t.trim().toLowerCase()).filter(Boolean)),
      ],
    },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { ...userField, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

galleryItemSchema.index({ isDeleted: 1, isActive: 1, order: 1, createdAt: -1 });
galleryItemSchema.index({ tags: 1 });

module.exports = mongoose.model("GalleryItem", galleryItemSchema);
