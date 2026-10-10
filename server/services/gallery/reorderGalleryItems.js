const GalleryItem = require("../../models/GalleryItem");
const { throwError } = require("../../utils");

/**
 * Sets the order of many items at once (admin panel drag and drop).
 * Nothing is changed if any of the items does not exist.
 */
exports.reorderGalleryItems = async ({ items }) => {
  const ids = items.map((item) => item.id);
  const existing = await GalleryItem.find({
    _id: { $in: ids },
    isDeleted: false,
  })
    .select("_id")
    .lean();
  const found = new Set(existing.map((doc) => String(doc._id)));
  const missing = ids.filter((id) => !found.has(String(id)));
  if (missing.length) {
    throwError(404, `Gallery item not found: ${missing.join(", ")}`);
  }
  await GalleryItem.bulkWrite(
    items.map(({ id, order }) => ({
      updateOne: {
        filter: { _id: id, isDeleted: false },
        update: { $set: { order } },
      },
    })),
  );
  return { updated: items.length };
};
