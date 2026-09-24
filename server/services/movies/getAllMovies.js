const mongoose = require("mongoose");
const Movie = require("../../models/Movie");
const { pagination, validateObjectId } = require("../../utils");

const toRegex = (value, exact = false) => {
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(exact ? `^${escaped}$` : escaped, "i");
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
  } = query;
  page = page ? Number(page) : 1;
  limit = limit ? Number(limit) : 10;
  const matchStage = { isDeleted: false };
  if (typeof isActive !== "undefined") {
    matchStage.isActive = isActive === "true" || isActive === true;
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
  const sortStage = {};
  sortStage[sortBy] = sortOrder === "asc" ? 1 : -1;
  pipeline.push({ $sort: sortStage });
  return await pagination(Movie, pipeline, page, limit);
};
