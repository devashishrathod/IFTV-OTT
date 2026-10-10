const GalleryItem = require("../../models/GalleryItem");
const { throwError, validateObjectId } = require("../../utils");
const { findGalleryItem, toGalleryItemView } = require("./galleryMedia");

// Public: inactive items are hidden from users
exports.getGalleryItem = async (id) => {
  const item = await findGalleryItem(id, { isActive: true });
  return toGalleryItemView(item);
};

exports.adminGetGalleryItem = async (id) => {
  validateObjectId(id, "Gallery item Id");
  const item = await GalleryItem.findOne({ _id: id, isDeleted: false }).populate(
    "createdBy",
    "name email role",
  );
  if (!item) throwError(404, "Gallery item not found");
  return toGalleryItemView(item, { admin: true });
};
