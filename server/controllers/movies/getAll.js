const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { validateGetAllMoviesQuery } = require("../../validator/movies");
const { getAllMovies } = require("../../services/movies");
const { applyMovieAccess } = require("../../services/subscriptions");

exports.getAll = asyncWrapper(async (req, res) => {
  const { error, value } = validateGetAllMoviesQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await getAllMovies(value);
  result.data = await applyMovieAccess(result.data, req.user);
  return sendSuccess(res, 200, "Movies fetched successfully", result);
});
