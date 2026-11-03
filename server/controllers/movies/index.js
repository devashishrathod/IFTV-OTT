const { create } = require("./create");
const { getAll } = require("./getAll");
const { get } = require("./get");
const { update } = require("./update");
const { deleteMovie } = require("./deleteMovie");
const { videoUploadUrl, videoStatus } = require("./video");
const { track, movieStats, leaderboard, viewers } = require("./stats");

module.exports = {
  create,
  getAll,
  get,
  deleteMovie,
  update,
  videoUploadUrl,
  videoStatus,
  track,
  movieStats,
  leaderboard,
  viewers,
};
