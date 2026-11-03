const express = require("express");
const router = express.Router();

const { isAdmin, optionalAuth } = require("../middlewares");
const {
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
} = require("../controllers/movies");

// Direct (browser -> Cloudflare) upload for large / GB videos
router.post("/video/upload-url", videoUploadUrl);
router.get("/video/:uid/status", videoStatus);

// Views / plays. Guests send a deviceId; admin / staff are not counted.
router.post("/:id/track", optionalAuth, track);
// Admin stats: all movies ranked, one movie's report, who watched it
router.get("/stats", isAdmin, leaderboard);
router.get("/:id/stats", isAdmin, movieStats);
router.get("/:id/viewers", isAdmin, viewers);

router.post("/add", create);
// Optional login: paid movies unlock for subscribers (and admin / staff)
router.get("/getAll", optionalAuth, getAll);
router.get("/:id/get", optionalAuth, get);
router.delete("/:id/delete", /*isAdmin,*/ deleteMovie);
router.put("/update/:id", /*isAdmin,*/ update);

module.exports = router;
