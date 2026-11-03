const { createMovie } = require("./createMovie");
const { getAllMovies } = require("./getAllMovies");
const { getMovie } = require("./getMovie");
const { deleteMovie } = require("./deleteMovie");
const { updateMovie } = require("./updateMovie");
const { createVideoUploadUrl, getVideoStatus } = require("./movieVideo");
const { trackMovieEvent } = require("./trackMovie");
const { getMovieStats } = require("./movieStats");
const { getMoviesLeaderboard } = require("./movieLeaderboard");
const { getMovieViewers } = require("./movieViewers");
const { withPublicStats } = require("./movieStatsView");

module.exports = {
  createMovie,
  getAllMovies,
  getMovie,
  deleteMovie,
  updateMovie,
  createVideoUploadUrl,
  getVideoStatus,
  trackMovieEvent,
  getMovieStats,
  getMoviesLeaderboard,
  getMovieViewers,
  withPublicStats,
};
