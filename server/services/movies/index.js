const { createMovie } = require("./createMovie");
const { getAllMovies } = require("./getAllMovies");
const { getMovie } = require("./getMovie");
const { deleteMovie } = require("./deleteMovie");
const { updateMovie } = require("./updateMovie");
const { createVideoUploadUrl, getVideoStatus } = require("./movieVideo");

module.exports = {
  createMovie,
  getAllMovies,
  getMovie,
  deleteMovie,
  updateMovie,
  createVideoUploadUrl,
  getVideoStatus,
};
