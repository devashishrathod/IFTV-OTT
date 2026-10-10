const { contactUs } = require("./contactUs");
const { create } = require("./create");
const { getMy } = require("./getMy");
const { get } = require("./get");
const { reply } = require("./reply");
const { close } = require("./close");
const { adminGetAll } = require("./adminGetAll");
const { adminGet } = require("./adminGet");
const { adminReply } = require("./adminReply");
const { adminUpdate } = require("./adminUpdate");
const { adminDelete } = require("./adminDelete");
const { adminStats } = require("./adminStats");

module.exports = {
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
};
