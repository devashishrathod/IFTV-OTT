const express = require("express");
const router = express.Router();

const { getAdminDashboard } = require("../controllers/dashboard");
const { isAdmin } = require("../middlewares");

// Revenue and personal data in one place: admin only (staff gets 403)
router.get("/admin", isAdmin, getAdminDashboard);

module.exports = router;
