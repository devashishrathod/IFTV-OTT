const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { updateMovie } = require("../../services/movies");
const { validateUpdateMovie } = require("../../validator/movies");

exports.update = asyncWrapper(async (req, res) => {
  const { error, value } = validateUpdateMovie(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const movieId = req.params.id;
  const image = req.files?.image;
  const video = req.files?.video;
  const result = await updateMovie(movieId, value, image, video);
  return sendSuccess(res, 200, "Movie updated successfully", result);
});
