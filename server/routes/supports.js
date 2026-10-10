const express = require("express");
const router = express.Router();

const { verifyJwtToken, validateRoles } = require("../middlewares");
const { ROLES } = require("../constants");
const {
  contactUs,
  create,
  getMy,
  get,
  reply,
  close,
  adminGetAll,
  adminGet,
  adminReply,
  adminUpdate,
  adminDelete,
  adminStats,
} = require("../controllers/supports");

// Tickets hold personal data, so auth stays on for every non-public route.
const isSupportAgent = validateRoles(ROLES.ADMIN, ROLES.STAFF);

// Public: web Contact Us form
router.post("/contact-us", contactUs);

// Logged-in user: own tickets
router.post("/create", verifyJwtToken, create);
router.get("/my", verifyJwtToken, getMy);
router.get("/get/:id", verifyJwtToken, get);
router.post("/reply/:id", verifyJwtToken, reply);
router.put("/close/:id", verifyJwtToken, close);

// Admin panel: admin + staff
router.get("/admin/getAll", isSupportAgent, adminGetAll);
router.get("/admin/stats", isSupportAgent, adminStats);
router.get("/admin/get/:id", isSupportAgent, adminGet);
router.post("/admin/reply/:id", isSupportAgent, adminReply);
router.put("/admin/update/:id", isSupportAgent, adminUpdate);
router.delete("/admin/delete/:id", isSupportAgent, adminDelete);

module.exports = router;
