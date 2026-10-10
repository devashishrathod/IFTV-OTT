const { createSubscription } = require("./createSubscription");
const { getSubscription } = require("./getSubscription");
const { getAllSubscription } = require("./getAllSubscription");
const { deleteSubscription } = require("./deleteSubscription");
const { updateSubscription } = require("./updateSubscription");
const { getPlans, getPlan } = require("./plans");
const {
  getMySubscription,
  getMySubscriptionHistory,
} = require("./mySubscription");
const {
  getSubscriptionSettings,
  updateSubscriptionSettings,
} = require("./settings");
const {
  adminGetUserSubscriptions,
  adminGetUserSubscriptionDetail,
  adminGrantSubscription,
  adminCancelSubscription,
} = require("./adminUserSubscriptions");
const { applyMovieAccess } = require("./movieAccess");

module.exports = {
  createSubscription,
  getSubscription,
  getAllSubscription,
  deleteSubscription,
  updateSubscription,
  getPlans,
  getPlan,
  getMySubscription,
  getMySubscriptionHistory,
  getSubscriptionSettings,
  updateSubscriptionSettings,
  adminGetUserSubscriptions,
  adminGetUserSubscriptionDetail,
  adminGrantSubscription,
  adminCancelSubscription,
  applyMovieAccess,
};
