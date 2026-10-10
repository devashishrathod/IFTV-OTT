const GalleryItem = require("../../models/GalleryItem");
const { GALLERY_LIMITS } = require("../../constants");
const { pagination } = require("../../utils");
const { DEFAULT_SORT } = require("./getAllGalleryItems");
const {
  escapeRegex,
  buildDateRange,
  toGalleryItemView,
} = require("./galleryMedia");

/**
 * Admin panel list: inactive items too, with who uploaded them.
 */
exports.adminGetAllGalleryItems = async (query) => {
  const {
    page = 1,
    limit = GALLERY_LIMITS.DEFAULT_PAGE_LIMIT,
    mediaType,
    isActive,
    tag,
    search,
    fromDate,
    toDate,
    sortBy,
    sortOrder = "desc",
  } = query;
  const match = { isDeleted: false };
  if (mediaType) match.mediaType = mediaType;
  if (typeof isActive === "boolean") match.isActive = isActive;
  if (tag) match.tags = tag.trim().toLowerCase();
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    match.$or = [{ title: regex }, { description: regex }];
  }
  const createdAt = buildDateRange(fromDate, toDate);
  if (createdAt) match.createdAt = createdAt;

  // Without sortBy the admin sees the same order as the users
  const direction = sortOrder === "asc" ? 1 : -1;
  const sort = sortBy ? { [sortBy]: direction, _id: direction } : DEFAULT_SORT;

  const pipeline = [
    { $match: match },
    { $sort: sort },
    {
      $lookup: {
        from: "users",
        localField: "createdBy",
        foreignField: "_id",
        as: "uploader",
      },
    },
    {
      $addFields: {
        createdBy: {
          $cond: [
            { $gt: [{ $size: "$uploader" }, 0] },
            {
              _id: { $arrayElemAt: ["$uploader._id", 0] },
              name: { $arrayElemAt: ["$uploader.name", 0] },
              email: { $arrayElemAt: ["$uploader.email", 0] },
              role: { $arrayElemAt: ["$uploader.role", 0] },
            },
            null,
          ],
        },
      },
    },
    { $project: { uploader: 0 } },
  ];
  const result = await pagination(GalleryItem, pipeline, page, limit);
  result.data = result.data.map((item) =>
    toGalleryItemView(item, { admin: true }),
  );
  return result;
};
