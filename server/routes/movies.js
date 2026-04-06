const express = require("express");
const router = express.Router();

const { isAdmin } = require("../middlewares");
const {
  create,
  getAll,
  get,
  deleteMovie,
  update,
} = require("../controllers/movies");

router.post("/add", create);
router.get("/getAll", getAll);
router.get("/:id/get", get);
router.delete("/:id/delete", isAdmin, deleteMovie);
router.put("/update/:id", isAdmin, update);

module.exports = router;
