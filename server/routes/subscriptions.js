const express = require("express");
const router = express.Router();

const { isAdmin } = require("../middlewares");
const {
  createSubscription,
  get,
  getAll,
  deleteSubscription,
} = require("../controllers/subscriptions");

router.post("/add", isAdmin, createSubscription);
router.get("/get/:id", get);
router.get("/get-all", getAll);
router.delete("/delete/:id", isAdmin, deleteSubscription);

module.exports = router;
