const { quote, createOrder, verify, failed } = require("./checkout");
const { webhook } = require("./webhook");
const { getMy, getMyOne } = require("./my");
const { adminGetAll, adminGet, adminSync, adminStats } = require("./admin");

module.exports = {
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
};
