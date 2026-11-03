const mongoose = require("mongoose");
const Movie = require("../../models/Movie");
const MovieActivity = require("../../models/MovieActivity");
const Category = require("../../models/Category");
const {
  DASHBOARD_RANGES,
  DASHBOARD_LIMITS,
  MOVIE_ACCESS_TYPES,
  MOVIE_STATS_LIMITS,
} = require("../../constants");
const { pagination } = require("../../utils");
const { resolvePeriod, toDayString } = require("../dashboard/dateRange");
const { toAllTimeStats } = require("./movieStatsView");
const {
  activityMatch,
  ACTIVITY_GROUP,
  ACTIVITY_COUNTS,
  toRangeStats,
  firstActivityDay,
} = require("./activityHelpers");

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// sortBy → field. Range numbers sit in inRange, all-time ones in stats.
const SORT_FIELDS = Object.freeze({
  views: "inRange.views",
  uniqueViewers: "inRange.uniqueViewers",
  plays: "inRange.plays",
  uniquePlayers: "inRange.uniquePlayers",
  playRate: "inRange.playRate",
  totalViews: "stats.views",
  totalPlays: "stats.plays",
  title: "title",
  createdAt: "createdAt",
});

exports.LEADERBOARD_SORT_FIELDS = Object.keys(SORT_FIELDS);

const movieMatchOf = ({ categoryId, accessType, isActive, search }) => {
  const match = { isDeleted: false };
  if (categoryId) match.categoryId = new mongoose.Types.ObjectId(categoryId);
  if (accessType === MOVIE_ACCESS_TYPES.PAID) {
    match.accessType = MOVIE_ACCESS_TYPES.PAID;
  } else if (accessType === MOVIE_ACCESS_TYPES.FREE) {
    // Movies saved before accessType existed have no value: they are free
    match.accessType = { $ne: MOVIE_ACCESS_TYPES.PAID };
  }
  if (typeof isActive === "boolean") {
    match.isActive = isActive ? { $ne: false } : false;
  }
  if (search) match.title = new RegExp(escapeRegex(search), "i");
  return match;
};

const playRateExpr = {
  $cond: [
    { $gt: ["$inRange.views", 0] },
    {
      $divide: [
        { $round: [{ $multiply: [{ $divide: ["$inRange.plays", "$inRange.views"] }, 1000] }, 0] },
        10,
      ],
    },
    0,
  ],
};

/**
 * Totals of the period over every movie the filters keep
 */
const summaryOf = async (movieMatch, range, platform) => {
  const movieIds = await Movie.distinct("_id", movieMatch);
  const [row] = await MovieActivity.aggregate([
    { $match: activityMatch(range, platform, { movieId: { $in: movieIds } }) },
    {
      $group: {
        _id: null,
        ...ACTIVITY_GROUP,
        movieIds: { $addToSet: "$movieId" },
      },
    },
    { $project: { ...ACTIVITY_COUNTS, moviesWatched: { $size: "$movieIds" } } },
  ]);
  return { ...toRangeStats(row), moviesWatched: row?.moviesWatched || 0 };
};

/**
 * Every movie with its numbers for the period, ranked by sortBy (default
 * plays). Movies nobody watched in the period are listed with zeros.
 */
exports.getMoviesLeaderboard = async (query) => {
  const {
    page = 1,
    limit = MOVIE_STATS_LIMITS.DEFAULT_PAGE_LIMIT,
    sortBy = "plays",
    sortOrder = "desc",
    platform,
  } = query;
  const firstRecordAt =
    query.range === DASHBOARD_RANGES.ALL_TIME ? await firstActivityDay() : null;
  const period = resolvePeriod({ ...query, compare: false }, new Date(), firstRecordAt);
  const movieMatch = movieMatchOf(query);
  const direction = sortOrder === "asc" ? 1 : -1;

  const pipeline = [
    { $match: movieMatch },
    {
      $lookup: {
        from: MovieActivity.collection.name,
        localField: "_id",
        foreignField: "movieId",
        pipeline: [
          { $match: activityMatch(period.current, platform) },
          { $group: { _id: null, ...ACTIVITY_GROUP } },
          { $project: { _id: 0, ...ACTIVITY_COUNTS } },
        ],
        as: "inRange",
      },
    },
    {
      $set: {
        inRange: {
          $ifNull: [
            { $first: "$inRange" },
            { views: 0, plays: 0, uniqueViewers: 0, uniquePlayers: 0 },
          ],
        },
      },
    },
    { $set: { "inRange.playRate": playRateExpr } },
    { $sort: { [SORT_FIELDS[sortBy]]: direction, _id: direction } },
    {
      $lookup: {
        from: Category.collection.name,
        localField: "categoryId",
        foreignField: "_id",
        pipeline: [{ $project: { name: 1 } }],
        as: "category",
      },
    },
    {
      $project: {
        title: 1,
        image: 1,
        accessType: 1,
        category: { $first: "$category" },
        languages: 1,
        durationInSeconds: 1,
        releaseDate: 1,
        isActive: 1,
        createdAt: 1,
        stats: 1,
        inRange: 1,
      },
    },
  ];

  const [list, summary] = await Promise.all([
    pagination(Movie, pipeline, page, limit, { allowEmpty: true }),
    summaryOf(movieMatch, period.current, platform),
  ]);
  const rankStart = (list.page - 1) * list.limit;
  list.data = list.data.map(({ stats, inRange, category, ...movie }, index) => ({
    rank: rankStart + index + 1,
    ...movie,
    accessType: movie.accessType || MOVIE_ACCESS_TYPES.FREE,
    category: category || null,
    inRange: toRangeStats(inRange),
    allTime: toAllTimeStats(stats),
  }));

  return {
    filters: {
      range: query.range,
      fromDate: toDayString(period.current.start),
      toDate: toDayString(new Date(period.current.end - 1)),
      days: period.days,
      platform: platform || null,
      categoryId: query.categoryId || null,
      accessType: query.accessType || null,
      isActive: typeof query.isActive === "boolean" ? query.isActive : null,
      search: query.search || null,
      sortBy,
      sortOrder,
      timezone: DASHBOARD_LIMITS.TIMEZONE,
    },
    summary,
    ...list,
  };
};
