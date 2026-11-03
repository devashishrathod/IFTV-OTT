const Movie = require("../../models/Movie");
const MovieActivity = require("../../models/MovieActivity");
const { MOVIE_ACCESS_TYPES, MOVIE_STATS_LIMITS } = require("../../constants");
const {
  activityMatch,
  ACTIVITY_GROUP,
  ACTIVITY_COUNTS,
  toRangeStats,
} = require("../movies/activityHelpers");
const { bucketKey } = require("./dateRange");
const { toKpi, first } = require("./helpers");

const totalsFacet = (match) => [
  { $match: match },
  { $group: { _id: null, views: { $sum: "$views" }, plays: { $sum: "$plays" } } },
];

/**
 * Movie views / plays of the date range (POST /movies/:id/track). platform
 * and categoryId apply; deleted movies are left out.
 */
exports.movieActivitySection = async ({ period, filters }) => {
  const { current, previous, groupBy } = period;
  const movieIds = await Movie.distinct("_id", filters.movieMatch);
  const extra = { movieId: { $in: movieIds } };
  const inCurrent = activityMatch(current, filters.platform, extra);
  const facet = {
    totals: totalsFacet(inCurrent),
    trend: [
      { $match: inCurrent },
      {
        $group: {
          _id: bucketKey("$day", groupBy),
          views: { $sum: "$views" },
          plays: { $sum: "$plays" },
        },
      },
    ],
    topMovies: [
      { $match: inCurrent },
      { $group: { _id: "$movieId", ...ACTIVITY_GROUP } },
      { $project: ACTIVITY_COUNTS },
      { $sort: { plays: -1, views: -1, _id: 1 } },
      { $limit: MOVIE_STATS_LIMITS.DASHBOARD_TOP_MOVIES },
      {
        $lookup: {
          from: Movie.collection.name,
          localField: "_id",
          foreignField: "_id",
          pipeline: [{ $project: { title: 1, image: 1, accessType: 1, isActive: 1 } }],
          as: "movie",
        },
      },
    ],
  };
  if (previous) {
    facet.previous = totalsFacet(activityMatch(previous, filters.platform, extra));
  }
  const [result] = await MovieActivity.aggregate([{ $facet: facet }]);

  const totals = first(result.totals);
  const before = previous ? first(result.previous) : null;
  return {
    kpis: {
      movieViews: toKpi(totals.views || 0, before ? before.views || 0 : null),
      moviePlays: toKpi(totals.plays || 0, before ? before.plays || 0 : null),
    },
    trend: { activity: result.trend },
    topMovies: result.topMovies.map(({ _id, movie, ...counts }, index) => ({
      rank: index + 1,
      _id,
      title: movie[0]?.title || null,
      image: movie[0]?.image || null,
      accessType: movie[0]?.accessType || MOVIE_ACCESS_TYPES.FREE,
      isActive: movie[0]?.isActive !== false,
      ...toRangeStats(counts),
    })),
  };
};
