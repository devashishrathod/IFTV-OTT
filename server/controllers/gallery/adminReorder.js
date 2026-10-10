const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { reorderGalleryItems } = require("../../services/gallery");
const { validateReorderGalleryItems } = require("../../validator/gallery");

exports.adminReorder = asyncWrapper(async (req, res) => {
  const { error, value } = validateReorderGalleryItems(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const result = await reorderGalleryItems(value);
  return sendSuccess(res, 200, "Gallery order updated successfully", result);
});
