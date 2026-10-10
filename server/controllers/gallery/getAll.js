const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { getAllGalleryItems } = require("../../services/gallery");
const { validateGetAllGalleryQuery } = require("../../validator/gallery");

exports.getAll = asyncWrapper(async (req, res) => {
  const { error, value } = validateGetAllGalleryQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await getAllGalleryItems(value);
  return sendSuccess(res, 200, "Gallery fetched successfully", result);
});
