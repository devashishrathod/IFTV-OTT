const mongoose = require("mongoose");
const Movie = require("../../models/Movie");
const MovieActivity = require("../../models/MovieActivity");
const { pagination, validateObjectId } = require("../../utils");
const { MOVIE_ACCESS_TYPES, MOVIE_STATS_LIMITS } = require("../../constants");
const { startOfDay, addDays } = require("../dashboard/dateRange");

const toRegex = (value, exact = false) => {
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(exact ? `^${escaped}$` : escaped, "i");
};

// sortBy shortcuts for the all-time counters
const STATS_SORT_FIELDS = Object.freeze({
  views: "stats.views",
  plays: "stats.plays",
});

/**
 * sortBy=trending: plays, then views, of the last TRENDING_DAYS days (today
 * included), then all-time plays. The helper field is dropped again.
 */
const trendingStages = (direction) => {
  const since = addDays(startOfDay(new Date()), -(MOVIE_STATS_LIMITS.TRENDING_DAYS - 1));
  return [
    {
      $lookup: {
        from: MovieActivity.collection.name,
        localField: "_id",
        foreignField: "movieId",
        pipeline: [
          { $match: { day: { $gte: since } } },
          { $group: { _id: null, views: { $sum: "$views" }, plays: { $sum: "$plays" } } },
        ],
        as: "trending",
      },
    },
    {
      $set: {
        trending: { $ifNull: [{ $first: "$trending" }, { views: 0, plays: 0 }] },
      },
    },
    {
      $sort: {
        "trending.plays": direction,
        "trending.views": direction,
        "stats.plays": direction,
        _id: direction,
      },
    },
    { $unset: "trending" },
  ];
};

exports.getAllMovies = async (query) => {
  let {
    page = 1,
    limit = 10,
    title,
    search,
    casts,
    languages,
    categoryId,
    releaseDate,
    fromDate,
    toDate,
    sortBy = "createdAt",
    sortOrder = "desc",
    isActive,
    accessType,
  } = query;
  page = page ? Number(page) : 1;
  limit = limit ? Number(limit) : 10;
  const matchStage = { isDeleted: false };
  if (typeof isActive !== "undefined") {
    matchStage.isActive = isActive === "true" || isActive === true;
  }
  if (accessType === MOVIE_ACCESS_TYPES.PAID) {
    matchStage.accessType = MOVIE_ACCESS_TYPES.PAID;
  } else if (accessType === MOVIE_ACCESS_TYPES.FREE) {
    // Movies saved before accessType existed have no value: they are free
    matchStage.accessType = { $ne: MOVIE_ACCESS_TYPES.PAID };
  }
  if (title) matchStage.title = toRegex(title.trim(), true);
  if (casts) matchStage.casts = { $regex: toRegex(casts) };
  if (languages) matchStage.languages = { $regex: toRegex(languages) };
  if (categoryId) {
    validateObjectId(categoryId, "Category Id");
    matchStage.categoryId = new mongoose.Types.ObjectId(categoryId);
  }
  if (search) {
    const searchRegex = toRegex(search);
    matchStage.$or = [
      { title: searchRegex },
      { description: searchRegex },
      { casts: searchRegex },
      { languages: searchRegex },
    ];
  }
  if (releaseDate) matchStage.releaseDate = new Date(releaseDate);
  if (fromDate || toDate) {
    matchStage.createdAt = {};
    if (fromDate) matchStage.createdAt.$gte = new Date(fromDate);
    if (toDate) {
      const d = new Date(toDate);
      d.setHours(23, 59, 59, 999);
      matchStage.createdAt.$lte = d;
    }
  }
  const pipeline = [{ $match: matchStage }];
  const direction = sortOrder === "asc" ? 1 : -1;
  if (sortBy === "trending") {
    pipeline.push(...trendingStages(direction));
  } else if (STATS_SORT_FIELDS[sortBy]) {
    pipeline.push({ $sort: { [STATS_SORT_FIELDS[sortBy]]: direction, _id: direction } });
  } else {
    const sortStage = {};
    sortStage[sortBy] = direction;
    pipeline.push({ $sort: sortStage });
  }
  return await pagination(Movie, pipeline, page, limit);
};
