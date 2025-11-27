const { asyncWrapper, sendSuccess } = require("../../utils");
const { getMovie } = require("../../services/movies");

exports.get = asyncWrapper(async (req, res) => {
  const result = await getMovie(req.params?.id);
  return sendSuccess(res, 200, "Movie fetched successfully", result);
});
