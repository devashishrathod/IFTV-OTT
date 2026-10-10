const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { bulkCreateGalleryItems } = require("../../services/gallery");
const { validateBulkCreateGalleryItems } = require("../../validator/gallery");

exports.adminBulkCreate = asyncWrapper(async (req, res) => {
  const { error, value } = validateBulkCreateGalleryItems(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const files = req.files?.media || req.files?.["media[]"];
  const result = await bulkCreateGalleryItems(value, files, req.userId);
  return sendSuccess(res, 201, "Gallery items created successfully", result);
});
