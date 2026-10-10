const { asyncWrapper, sendSuccess } = require("../../utils");
const { deleteGalleryItem } = require("../../services/gallery");

exports.adminDelete = asyncWrapper(async (req, res) => {
  await deleteGalleryItem(req.params.id);
  return sendSuccess(res, 200, "Gallery item deleted successfully");
});
