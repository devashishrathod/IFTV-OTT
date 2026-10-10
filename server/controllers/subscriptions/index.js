const { createSubscription } = require("./createSubscription");
const { get } = require("./get");
const { getAll } = require("./getAll");
const { deleteSubscription } = require("./delete");
const { updateSubscription } = require("./update");
const { plans, plan } = require("./plans");
const { my, myHistory } = require("./my");
const {
  adminUsers,
  adminUser,
  adminGrant,
  adminCancel,
  adminGetSettings,
  adminUpdateSettings,
} = require("./admin");

module.exports = {
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
};
