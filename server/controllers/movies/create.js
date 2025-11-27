const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { createMovie } = require("../../services/movies");
const { validateCreateMovie } = require("../../validator/movies");

exports.create = asyncWrapper(async (req, res) => {
  const { error, value } = validateCreateMovie(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const image = req.files?.image;
  const video = req.files?.video;
  const result = await createMovie(value, image, video);
  return sendSuccess(res, 201, "Movie created successfully", result);
});
