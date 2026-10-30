const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { getAdminDashboard } = require("../../services/dashboard");
const { validateDashboardQuery } = require("../../validator/dashboard");

exports.getAdminDashboard = asyncWrapper(async (req, res) => {
  const { error, value } = validateDashboardQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await getAdminDashboard(value);
  return sendSuccess(res, 200, "Dashboard fetched successfully", result);
});
