const Movie = require("../../models/Movie");
const MovieActivity = require("../../models/MovieActivity");
const User = require("../../models/User");
const {
  DASHBOARD_RANGES,
  DASHBOARD_LIMITS,
  MOVIE_STATS_LIMITS,
} = require("../../constants");
const { throwError, validateObjectId, pagination } = require("../../utils");
const { resolvePeriod, toDayString } = require("../dashboard/dateRange");
const { activityMatch, firstActivityDay } = require("./activityHelpers");

const USER_REF = "name email mobile image";
const GUEST_PREFIX = "device:";

const SORT_FIELDS = Object.freeze({
  lastActiveAt: "lastActiveAt",
  views: "views",
  plays: "plays",
});

exports.VIEWER_SORT_FIELDS = Object.keys(SORT_FIELDS);

/**
 * Who opened / played one movie in the period, one row per viewer (a user,
 * or a guest device), with their counted views and plays.
 */
exports.getMovieViewers = async (movieId, query) => {
  validateObjectId(movieId, "Movie Id");
  const movie = await Movie.findOne({ _id: movieId, isDeleted: false }).select("title").lean();
  if (!movie) throwError(404, "Movie not found");
  const {
    page = 1,
    limit = MOVIE_STATS_LIMITS.DEFAULT_PAGE_LIMIT,
    sortBy = "lastActiveAt",
    sortOrder = "desc",
    platform,
    viewerType,
  } = query;
  const firstRecordAt =
    query.range === DASHBOARD_RANGES.ALL_TIME
      ? await firstActivityDay({ movieId: movie._id })
      : null;
  const period = resolvePeriod({ ...query, compare: false }, new Date(), firstRecordAt);
  const direction = sortOrder === "asc" ? 1 : -1;

  const pipeline = [
    { $match: activityMatch(period.current, platform, { movieId: movie._id }) },
    { $sort: { day: 1, updatedAt: 1 } },
    {
      $group: {
        _id: "$viewerKey",
        userId: { $last: "$userId" },
        viewerType: { $last: "$viewerType" },
        views: { $sum: "$views" },
        plays: { $sum: "$plays" },
        platforms: { $addToSet: { $ifNull: ["$platform", "unknown"] } },
        lastViewedAt: { $max: "$lastViewedAt" },
        lastPlayedAt: { $max: "$lastPlayedAt" },
      },
    },
    ...(viewerType ? [{ $match: { viewerType } }] : []),
    { $set: { lastActiveAt: { $max: ["$lastViewedAt", "$lastPlayedAt"] } } },
    { $sort: { [SORT_FIELDS[sortBy]]: direction, _id: direction } },
  ];
  const list = await pagination(MovieActivity, pipeline, page, limit, { allowEmpty: true });

  const userIds = list.data.map((row) => row.userId).filter(Boolean);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select(USER_REF).lean()
    : [];
  const usersById = new Map(users.map((user) => [String(user._id), user]));
  list.data = list.data.map(({ _id: viewerKey, userId, platforms, ...row }) => ({
    user: userId ? usersById.get(String(userId)) || null : null,
    // Guests only: the device the app / site sent
    deviceId: viewerKey.startsWith(GUEST_PREFIX) ? viewerKey.slice(GUEST_PREFIX.length) : null,
    ...row,
    platforms: platforms.sort(),
  }));

  return {
    movie: { _id: movie._id, title: movie.title },
    filters: {
      range: query.range,
      fromDate: toDayString(period.current.start),
      toDate: toDayString(new Date(period.current.end - 1)),
      platform: platform || null,
      viewerType: viewerType || null,
      sortBy,
      sortOrder,
      timezone: DASHBOARD_LIMITS.TIMEZONE,
    },
    ...list,
  };
};
