const { deleteFiles, findGalleryItem } = require("./galleryMedia");

/**
 * Soft deletes the item and removes its files from Cloudflare, so it cannot
 * be restored later.
 */
exports.deleteGalleryItem = async (id) => {
  const item = await findGalleryItem(id);
  item.isDeleted = true;
  item.isActive = false;
  await item.save();
  await deleteFiles([item.media, item.poster]);
};
