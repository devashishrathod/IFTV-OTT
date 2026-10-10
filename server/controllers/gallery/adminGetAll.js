const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { adminGetAllGalleryItems } = require("../../services/gallery");
const { validateAdminGetAllGalleryQuery } = require("../../validator/gallery");

exports.adminGetAll = asyncWrapper(async (req, res) => {
  const { error, value } = validateAdminGetAllGalleryQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await adminGetAllGalleryItems(value);
  return sendSuccess(res, 200, "Gallery items fetched successfully", result);
});
