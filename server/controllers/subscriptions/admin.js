const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const {
  validateAdminUserSubscriptionsQuery,
  validateGrantSubscription,
  validateCancelSubscription,
  validateSettings,
} = require("../../validator/subscriptions");
const {
  adminGetUserSubscriptions,
  adminGetUserSubscriptionDetail,
  adminGrantSubscription,
  adminCancelSubscription,
  getSubscriptionSettings,
  updateSubscriptionSettings,
} = require("../../services/subscriptions");

exports.adminUsers = asyncWrapper(async (req, res) => {
  const { error, value } = validateAdminUserSubscriptionsQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await adminGetUserSubscriptions(value);
  return sendSuccess(res, 200, "User subscriptions fetched", result);
});

exports.adminUser = asyncWrapper(async (req, res) => {
  const result = await adminGetUserSubscriptionDetail(req.params?.userId);
  return sendSuccess(res, 200, "User subscription fetched", result);
});

exports.adminGrant = asyncWrapper(async (req, res) => {
  const { error, value } = validateGrantSubscription(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const result = await adminGrantSubscription(value, req.userId);
  return sendSuccess(res, 201, "Subscription granted", result);
});

exports.adminCancel = asyncWrapper(async (req, res) => {
  const { error, value } = validateCancelSubscription(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const result = await adminCancelSubscription(req.params?.id, value, req.userId);
  return sendSuccess(res, 200, "Subscription cancelled", result);
});

exports.adminGetSettings = asyncWrapper(async (req, res) => {
  const result = await getSubscriptionSettings();
  return sendSuccess(res, 200, "Subscription settings fetched", result);
});

exports.adminUpdateSettings = asyncWrapper(async (req, res) => {
  const { error, value } = validateSettings(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const result = await updateSubscriptionSettings(value, req.userId);
  return sendSuccess(res, 200, "Subscription settings updated", result);
});
