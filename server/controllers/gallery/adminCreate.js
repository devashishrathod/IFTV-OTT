const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { createGalleryItem } = require("../../services/gallery");
const { validateCreateGalleryItem } = require("../../validator/gallery");

exports.adminCreate = asyncWrapper(async (req, res) => {
  const { error, value } = validateCreateGalleryItem(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const files = { media: req.files?.media, poster: req.files?.poster };
  const result = await createGalleryItem(value, files, req.userId);
  return sendSuccess(res, 201, "Gallery item created successfully", result);
});
