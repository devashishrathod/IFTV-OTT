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
} = require("../controllers/movies");

// Direct (browser -> Cloudflare) upload for large / GB videos
router.post("/video/upload-url", videoUploadUrl);
router.get("/video/:uid/status", videoStatus);

router.post("/add", create);
// Optional login: paid movies unlock for subscribers (and admin / staff)
router.get("/getAll", optionalAuth, getAll);
router.get("/:id/get", optionalAuth, get);
router.delete("/:id/delete", /*isAdmin,*/ deleteMovie);
router.put("/update/:id", /*isAdmin,*/ update);

module.exports = router;
