const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { validateGetAllMoviesQuery } = require("../../validator/movies");
const { getAllMovies } = require("../../services/movies");

exports.getAll = asyncWrapper(async (req, res) => {
  const { error, value } = validateGetAllMoviesQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await getAllMovies(value);
  return sendSuccess(res, 200, "Movies fetched successfully", result);
});
