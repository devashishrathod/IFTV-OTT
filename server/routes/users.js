const express = require("express");
const router = express.Router();

const { getUser, updateUser, getAllUsers } = require("../controllers/users");
const { verifyJwtToken, validateRoles } = require("../middlewares");
const { ROLES } = require("../constants");

// Admin panel user list holds personal data: admin + staff only
const isUserViewer = validateRoles(ROLES.ADMIN, ROLES.STAFF);

router.get("/get", verifyJwtToken, getUser);
router.put("/update", verifyJwtToken, updateUser);
router.get("/get-all", isUserViewer, getAllUsers);

module.exports = router;
