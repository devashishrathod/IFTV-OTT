const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const {
  validateTrackMovie,
  validateMovieStatsQuery,
  validateMoviesLeaderboardQuery,
  validateMovieViewersQuery,
} = require("../../validator/movies");
const {
  trackMovieEvent,
  getMovieStats,
  getMoviesLeaderboard,
  getMovieViewers,
} = require("../../services/movies");

exports.track = asyncWrapper(async (req, res) => {
  const { error, value } = validateTrackMovie(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const result = await trackMovieEvent(req.params?.id, value, req.user);
  const message = result.counted ? "Movie event recorded" : "Movie event not counted";
  return sendSuccess(res, 200, message, result);
});

exports.movieStats = asyncWrapper(async (req, res) => {
  const { error, value } = validateMovieStatsQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await getMovieStats(req.params?.id, value);
  return sendSuccess(res, 200, "Movie stats fetched successfully", result);
});

exports.leaderboard = asyncWrapper(async (req, res) => {
  const { error, value } = validateMoviesLeaderboardQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await getMoviesLeaderboard(value);
  return sendSuccess(res, 200, "Movie stats fetched successfully", result);
});

exports.viewers = asyncWrapper(async (req, res) => {
  const { error, value } = validateMovieViewersQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await getMovieViewers(req.params?.id, value);
  return sendSuccess(res, 200, "Movie viewers fetched successfully", result);
});
