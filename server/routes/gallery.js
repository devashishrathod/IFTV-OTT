const express = require("express");
const router = express.Router();

const { validateRoles } = require("../middlewares");
const { ROLES } = require("../constants");
const {
  getAll,
  get,
  adminCreate,
  adminBulkCreate,
  adminGetAll,
  adminGet,
  adminUpdate,
  adminReorder,
  adminDelete,
  adminVideoUploadUrl,
  adminVideoStatus,
} = require("../controllers/gallery");

const isGalleryManager = validateRoles(ROLES.ADMIN, ROLES.STAFF);

// Public: app + web gallery, no login
router.get("/getAll", getAll);
router.get("/get/:id", get);

// Admin panel: admin + staff
// Direct (browser -> Cloudflare) upload for large / GB videos
router.post("/admin/video/upload-url", isGalleryManager, adminVideoUploadUrl);
router.get("/admin/video/:uid/status", isGalleryManager, adminVideoStatus);

router.post("/admin/create", isGalleryManager, adminCreate);
router.post("/admin/bulk-create", isGalleryManager, adminBulkCreate);
router.get("/admin/getAll", isGalleryManager, adminGetAll);
router.get("/admin/get/:id", isGalleryManager, adminGet);
router.put("/admin/update/:id", isGalleryManager, adminUpdate);
router.put("/admin/reorder", isGalleryManager, adminReorder);
router.delete("/admin/delete/:id", isGalleryManager, adminDelete);

module.exports = router;
