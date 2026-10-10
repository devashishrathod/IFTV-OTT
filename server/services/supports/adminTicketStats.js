const SupportTicket = require("../../models/SupportTicket");
const { SUPPORT_SOURCES, SUPPORT_STATUSES } = require("../../constants");
const { buildDateRange } = require("./ticketHelpers");

// { open: 3, in_progress: 0, ... } with every key present, zeros included.
const toCounts = (keys, rows = []) =>
  Object.fromEntries(
    keys.map((key) => [key, rows.find((r) => r._id === key)?.count || 0]),
  );

exports.adminTicketStats = async ({ fromDate, toDate }) => {
  const match = { isDeleted: false };
  const createdAt = buildDateRange(fromDate, toDate);
  if (createdAt) match.createdAt = createdAt;
  const [result] = await SupportTicket.aggregate([
    { $match: match },
    {
      $facet: {
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        bySource: [{ $group: { _id: "$source", count: { $sum: 1 } } }],
      },
    },
  ]);
  const byStatus = toCounts(Object.values(SUPPORT_STATUSES), result?.byStatus);
  const bySource = toCounts(Object.values(SUPPORT_SOURCES), result?.bySource);
  const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
  return { total, byStatus, bySource };
};
