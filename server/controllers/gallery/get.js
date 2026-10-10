const { asyncWrapper, sendSuccess } = require("../../utils");
const { getGalleryItem } = require("../../services/gallery");

exports.get = asyncWrapper(async (req, res) => {
  const result = await getGalleryItem(req.params.id);
  return sendSuccess(res, 200, "Gallery item fetched successfully", result);
});
