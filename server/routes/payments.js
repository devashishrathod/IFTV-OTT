const express = require("express");
const router = express.Router();

const { isAdmin, verifyJwtToken, validateRoles } = require("../middlewares");
const { ROLES } = require("../constants");
const {
  quote,
  createOrder,
  verify,
  failed,
  webhook,
  getMy,
  getMyOne,
  adminGetAll,
  adminGet,
  adminSync,
  adminStats,
} = require("../controllers/payments");

const isPaymentViewer = validateRoles(ROLES.ADMIN, ROLES.STAFF);

// Razorpay server-to-server (signature checked, no login)
router.post("/webhook", webhook);

// Logged-in user (web + Android; iOS can only read)
router.get("/quote", verifyJwtToken, quote);
router.post("/create-order", verifyJwtToken, createOrder);
router.post("/verify", verifyJwtToken, verify);
router.post("/failed", verifyJwtToken, failed);
router.get("/my", verifyJwtToken, getMy);
router.get("/my/:id", verifyJwtToken, getMyOne);

// Admin panel: reads for admin + staff, sync for admin
router.get("/admin/getAll", isPaymentViewer, adminGetAll);
router.get("/admin/stats", isPaymentViewer, adminStats);
router.get("/admin/get/:id", isPaymentViewer, adminGet);
router.post("/admin/sync/:id", isAdmin, adminSync);

module.exports = router;
