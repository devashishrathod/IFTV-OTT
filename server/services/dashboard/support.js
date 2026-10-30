const SupportTicket = require("../../models/SupportTicket");
const {
  PLATFORMS,
  SUPPORT_SOURCES,
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  SUPPORT_PRIORITIES,
} = require("../../constants");
const { inRange, bucketKey } = require("./dateRange");
const { toCircle, toKpi, first, round1 } = require("./helpers");

const { OPEN, IN_PROGRESS } = SUPPORT_STATUSES;
const HOUR_MS = 60 * 60 * 1000;

// When the ticket was finished: resolved, or closed without a resolve
const doneAt = { $ifNull: ["$resolvedAt", "$closedAt"] };
const countIf = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });

/**
 * Tickets created in the date range, plus the open queue today. platform
 * narrows everything here.
 */
exports.supportSection = async ({ period, filters }) => {
  const { current, previous, groupBy } = period;
  const createdIn = { $match: { createdAt: inRange(current) } };
  const groupOn = (field) => [createdIn, { $group: { _id: field, count: { $sum: 1 } } }];
  const facet = {
    byStatus: groupOn("$status"),
    byCategory: groupOn("$category"),
    byPriority: groupOn("$priority"),
    bySource: groupOn("$source"),
    byPlatform: groupOn("$platform"),
    queue: [
      { $match: { status: { $in: [OPEN, IN_PROGRESS] } } },
      {
        $group: {
          _id: null,
          open: countIf({ $eq: ["$status", OPEN] }),
          inProgress: countIf({ $eq: ["$status", IN_PROGRESS] }),
          unassigned: countIf({ $eq: [{ $ifNull: ["$assignedTo", null] }, null] }),
          highPriority: countIf({ $eq: ["$priority", SUPPORT_PRIORITIES.HIGH] }),
        },
      },
    ],
    resolution: [
      createdIn,
      { $match: { $expr: { $ne: [doneAt, null] } } },
      { $group: { _id: null, avgMs: { $avg: { $subtract: [doneAt, "$createdAt"] } } } },
    ],
    createdTrend: [createdIn, { $group: { _id: bucketKey("$createdAt", groupBy), count: { $sum: 1 } } }],
    doneTrend: [
      { $addFields: { doneAt } },
      { $match: { doneAt: inRange(current) } },
      { $group: { _id: bucketKey("$doneAt", groupBy), count: { $sum: 1 } } },
    ],
  };
  if (previous) {
    facet.previous = [{ $match: { createdAt: inRange(previous) } }, { $count: "count" }];
  }

  const [result] = await SupportTicket.aggregate([
    { $match: filters.ticketMatch },
    { $facet: facet },
  ]);

  const byStatus = toCircle(result.byStatus, { keys: Object.values(SUPPORT_STATUSES) });
  const queue = first(result.queue);
  const avgMs = first(result.resolution).avgMs;
  const openTickets = (queue.open || 0) + (queue.inProgress || 0);

  return {
    kpis: {
      newTickets: toKpi(byStatus.total, previous ? first(result.previous).count || 0 : null),
      openTickets,
    },
    section: {
      totalInRange: byStatus.total,
      open: queue.open || 0,
      inProgress: queue.inProgress || 0,
      unassignedOpen: queue.unassigned || 0,
      highPriorityOpen: queue.highPriority || 0,
      avgResolutionHours: avgMs === null || avgMs === undefined ? null : round1(avgMs / HOUR_MS),
    },
    circles: {
      ticketsByStatus: byStatus,
      ticketsByCategory: toCircle(result.byCategory, { keys: Object.values(SUPPORT_CATEGORIES) }),
      ticketsByPriority: toCircle(result.byPriority, { keys: Object.values(SUPPORT_PRIORITIES) }),
      ticketsBySource: toCircle(result.bySource, { keys: Object.values(SUPPORT_SOURCES) }),
      ticketsByPlatform: toCircle(result.byPlatform, { keys: Object.values(PLATFORMS) }),
    },
    trend: { created: result.createdTrend, done: result.doneTrend },
  };
};
