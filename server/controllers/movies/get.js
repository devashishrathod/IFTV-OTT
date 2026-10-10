const { asyncWrapper, sendSuccess } = require("../../utils");
const { getMovie } = require("../../services/movies");
const { applyMovieAccess } = require("../../services/subscriptions");

exports.get = asyncWrapper(async (req, res) => {
  const movie = await getMovie(req.params?.id);
  const result = await applyMovieAccess(movie, req.user);
  return sendSuccess(res, 200, "Movie fetched successfully", result);
});
