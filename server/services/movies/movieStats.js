const Movie = require("../../models/Movie");
const MovieActivity = require("../../models/MovieActivity");
const {
  PLATFORMS,
  DASHBOARD_RANGES,
  DASHBOARD_LIMITS,
  MOVIE_VIEWER_TYPES,
} = require("../../constants");
const { throwError, validateObjectId } = require("../../utils");
const { resolvePeriod, buildBuckets, bucketKey, toDayString } = require("../dashboard/dateRange");
const { toCircle, toKpi, first } = require("../dashboard/helpers");
const { toAllTimeStats } = require("./movieStatsView");
const {
  activityMatch,
  ACTIVITY_GROUP,
  ACTIVITY_COUNTS,
  toRangeStats,
  firstActivityDay,
} = require("./activityHelpers");

const MOVIE_FIELDS =
  "title image accessType categoryId languages durationInSeconds releaseDate isActive createdAt stats";

const totalsFacet = (match) => [
  { $match: match },
  { $group: { _id: null, ...ACTIVITY_GROUP } },
  { $project: ACTIVITY_COUNTS },
];

const rangeView = (range) =>
  range
    ? { fromDate: toDayString(range.start), toDate: toDayString(new Date(range.end - 1)) }
    : { fromDate: null, toDate: null };

// One circle item per key, counted on `field` of the grouped rows
const circleOf = (rows, field, keys) =>
  toCircle(
    rows.map((row) => ({ _id: row._id, count: row[field] })),
    { keys }
  );

/**
 * One movie's report for the admin panel: all-time counters, the period's
 * numbers against the period before, a chart and circles.
 */
exports.getMovieStats = async (movieId, query) => {
  validateObjectId(movieId, "Movie Id");
  const movie = await Movie.findOne({ _id: movieId, isDeleted: false })
    .select(MOVIE_FIELDS)
    .populate("categoryId", "name")
    .lean();
  if (!movie) throwError(404, "Movie not found");

  const firstRecordAt =
    query.range === DASHBOARD_RANGES.ALL_TIME
      ? await firstActivityDay({ movieId: movie._id })
      : null;
  const period = resolvePeriod(query, new Date(), firstRecordAt);
  const current = activityMatch(period.current, query.platform, { movieId: movie._id });
  const facet = {
    totals: totalsFacet(current),
    trend: [
      { $match: current },
      { $group: { _id: bucketKey("$day", period.groupBy), ...ACTIVITY_GROUP } },
      { $project: ACTIVITY_COUNTS },
    ],
    byPlatform: [
      { $match: current },
      { $group: { _id: "$platform", views: { $sum: "$views" }, plays: { $sum: "$plays" } } },
    ],
    // Each viewer once, by the type they had on their latest day
    byViewerType: [
      { $match: current },
      { $sort: { day: 1, updatedAt: 1 } },
      {
        $group: {
          _id: "$viewerKey",
          viewerType: { $last: "$viewerType" },
          views: { $sum: "$views" },
          plays: { $sum: "$plays" },
        },
      },
      {
        $group: {
          _id: "$viewerType",
          viewers: { $sum: { $cond: [{ $gt: ["$views", 0] }, 1, 0] } },
          players: { $sum: { $cond: [{ $gt: ["$plays", 0] }, 1, 0] } },
        },
      },
    ],
  };
  if (period.previous) {
    facet.previous = totalsFacet(
      activityMatch(period.previous, query.platform, { movieId: movie._id })
    );
  }
  const [result] = await MovieActivity.aggregate([{ $facet: facet }]);

  const stats = toRangeStats(first(result.totals));
  const previous = period.previous ? toRangeStats(first(result.previous)) : null;
  const trend = new Map(result.trend.map((row) => [row._id, row]));
  const platforms = Object.values(PLATFORMS);
  const viewerTypes = Object.values(MOVIE_VIEWER_TYPES);
  const { categoryId, stats: allTime, ...details } = movie;
  const compared = rangeView(period.previous);

  return {
    movie: { ...details, category: categoryId || null },
    filters: {
      range: query.range,
      ...rangeView(period.current),
      days: period.days,
      groupBy: period.groupBy,
      platform: query.platform || null,
      compare: Boolean(period.previous),
      previousFromDate: compared.fromDate,
      previousToDate: compared.toDate,
      timezone: DASHBOARD_LIMITS.TIMEZONE,
    },
    allTime: toAllTimeStats(allTime),
    overview: Object.fromEntries(
      Object.entries(stats).map(([key, value]) => [key, toKpi(value, previous ? previous[key] : null)])
    ),
    charts: {
      groupBy: period.groupBy,
      points: buildBuckets(period.current, period.groupBy).map((bucket) => {
        const row = trend.get(bucket.date);
        return {
          ...bucket,
          views: row?.views || 0,
          plays: row?.plays || 0,
          uniqueViewers: row?.uniqueViewers || 0,
          uniquePlayers: row?.uniquePlayers || 0,
        };
      }),
    },
    circles: {
      viewsByPlatform: circleOf(result.byPlatform, "views", platforms),
      playsByPlatform: circleOf(result.byPlatform, "plays", platforms),
      viewersByType: circleOf(result.byViewerType, "viewers", viewerTypes),
      playersByType: circleOf(result.byViewerType, "players", viewerTypes),
    },
  };
};
