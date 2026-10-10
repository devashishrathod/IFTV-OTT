const { asyncWrapper, sendSuccess } = require("../../utils");
const { adminGetGalleryItem } = require("../../services/gallery");

exports.adminGet = asyncWrapper(async (req, res) => {
  const result = await adminGetGalleryItem(req.params.id);
  return sendSuccess(res, 200, "Gallery item fetched successfully", result);
});
