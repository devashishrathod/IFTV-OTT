const GalleryItem = require("../../models/GalleryItem");
const { GALLERY_LIMITS } = require("../../constants");
const { pagination } = require("../../utils");
const { escapeRegex, toGalleryItemView } = require("./galleryMedia");

// Admin-chosen order first, newest first within the same order
const DEFAULT_SORT = { order: 1, createdAt: -1, _id: -1 };

exports.DEFAULT_SORT = DEFAULT_SORT;

/**
 * Public gallery for app / web: only active items.
 */
exports.getAllGalleryItems = async (query) => {
  const {
    page = 1,
    limit = GALLERY_LIMITS.DEFAULT_PAGE_LIMIT,
    mediaType,
    tag,
    search,
  } = query;
  const match = { isDeleted: false, isActive: true };
  if (mediaType) match.mediaType = mediaType;
  if (tag) match.tags = tag.trim().toLowerCase();
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    match.$or = [{ title: regex }, { description: regex }];
  }
  const pipeline = [{ $match: match }, { $sort: DEFAULT_SORT }];
  const result = await pagination(GalleryItem, pipeline, page, limit);
  result.data = result.data.map((item) => toGalleryItemView(item));
  return result;
};
