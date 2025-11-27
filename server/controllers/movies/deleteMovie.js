const { asyncWrapper, sendSuccess } = require("../../utils");
const { deleteMovie } = require("../../services/movies");

exports.deleteMovie = asyncWrapper(async (req, res) => {
  await deleteMovie(req.params?.id);
  return sendSuccess(res, 200, "Movie deleted successfully");
});
