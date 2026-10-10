const express = require("express");
const router = express.Router();

const { isAdmin, verifyJwtToken, validateRoles } = require("../middlewares");
const { ROLES } = require("../constants");
const {
  createSubscription,
  get,
  getAll,
  deleteSubscription,
  updateSubscription,
  plans,
  plan,
  my,
  myHistory,
  adminUsers,
  adminUser,
  adminGrant,
  adminCancel,
  adminGetSettings,
  adminUpdateSettings,
} = require("../controllers/subscriptions");

// Admin panel reads: admin + staff. Every write: admin only.
const isSubscriptionViewer = validateRoles(ROLES.ADMIN, ROLES.STAFF);

// Public: plan screens on web / app (active plans only)
router.get("/plans", plans);
router.get("/plans/:id", plan);

// Logged-in user: own plan and history
router.get("/my", verifyJwtToken, my);
router.get("/my/history", verifyJwtToken, myHistory);

// Plans (admin panel). get-all / get stay open as before so existing
// screens keep working; changes need an admin token.
router.post("/add", isAdmin, createSubscription);
router.get("/get/:id", get);
router.get("/get-all", getAll);
router.put("/update/:id", isAdmin, updateSubscription);
router.delete("/delete/:id", isAdmin, deleteSubscription);

// User subscriptions + settings (admin panel)
router.get("/admin/users", isSubscriptionViewer, adminUsers);
router.get("/admin/users/:userId", isSubscriptionViewer, adminUser);
router.post("/admin/grant", isAdmin, adminGrant);
router.put("/admin/cancel/:id", isAdmin, adminCancel);
router.get("/admin/settings", isSubscriptionViewer, adminGetSettings);
router.put("/admin/settings", isAdmin, adminUpdateSettings);

module.exports = router;
