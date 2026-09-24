const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const {
  createVideoUploadUrl,
  getVideoStatus,
} = require("../../services/movies");
const { validateVideoUploadUrl } = require("../../validator/movies");

exports.videoUploadUrl = asyncWrapper(async (req, res) => {
  const { error, value } = validateVideoUploadUrl(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const result = await createVideoUploadUrl(value);
  return sendSuccess(res, 201, "Video upload URL created", result);
});

exports.videoStatus = asyncWrapper(async (req, res) => {
  const result = await getVideoStatus(req.params.uid);
  return sendSuccess(res, 200, "Video status fetched", result);
});
