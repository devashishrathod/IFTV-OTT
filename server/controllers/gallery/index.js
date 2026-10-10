const { getAll } = require("./getAll");
const { get } = require("./get");
const { adminCreate } = require("./adminCreate");
const { adminBulkCreate } = require("./adminBulkCreate");
const { adminGetAll } = require("./adminGetAll");
const { adminGet } = require("./adminGet");
const { adminUpdate } = require("./adminUpdate");
const { adminReorder } = require("./adminReorder");
const { adminDelete } = require("./adminDelete");
const { adminVideoUploadUrl, adminVideoStatus } = require("./adminVideo");

module.exports = {
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
};
