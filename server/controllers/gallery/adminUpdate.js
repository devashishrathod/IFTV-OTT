const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { updateGalleryItem } = require("../../services/gallery");
const { validateUpdateGalleryItem } = require("../../validator/gallery");

exports.adminUpdate = asyncWrapper(async (req, res) => {
  const { error, value } = validateUpdateGalleryItem(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const files = { media: req.files?.media, poster: req.files?.poster };
  const result = await updateGalleryItem(req.params.id, value, files);
  return sendSuccess(res, 200, "Gallery item updated successfully", result);
});
