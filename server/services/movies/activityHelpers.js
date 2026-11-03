const MovieActivity = require("../../models/MovieActivity");
const { inRange } = require("../dashboard/dateRange");
const { playRate } = require("./movieStatsView");

// The row's viewerKey when it has that event, else null (dropped when counted)
const keyIf = (field) => ({ $cond: [{ $gt: [field, 0] }, "$viewerKey", null] });
const sizeWithoutNull = (set) => ({ $size: { $setDifference: [set, [null]] } });

/**
 * MovieActivity rows of a period, optionally of one platform. `extra` adds
 * conditions such as movieId.
 */
exports.activityMatch = (range, platform, extra = {}) => ({
  ...extra,
  day: inRange(range),
  ...(platform ? { platform } : {}),
});

// $group fields: totals plus the distinct viewers / players behind them
exports.ACTIVITY_GROUP = Object.freeze({
  views: { $sum: "$views" },
  plays: { $sum: "$plays" },
  viewerKeys: { $addToSet: keyIf("$views") },
  playerKeys: { $addToSet: keyIf("$plays") },
});

// $project fields turning an ACTIVITY_GROUP row into counts
exports.ACTIVITY_COUNTS = Object.freeze({
  views: 1,
  plays: 1,
  uniqueViewers: sizeWithoutNull("$viewerKeys"),
  uniquePlayers: sizeWithoutNull("$playerKeys"),
});

exports.toRangeStats = (row = {}) => {
  const views = row?.views || 0;
  const plays = row?.plays || 0;
  return {
    views,
    uniqueViewers: row?.uniqueViewers || 0,
    plays,
    uniquePlayers: row?.uniquePlayers || 0,
    playRate: playRate(plays, views),
  };
};

// First tracked day (for range=all_time), optionally of one movie
exports.firstActivityDay = async (filter = {}) => {
  const row = await MovieActivity.findOne(filter).sort({ day: 1 }).select("day").lean();
  return row?.day || null;
};
