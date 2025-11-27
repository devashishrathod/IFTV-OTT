const mongoose = require("mongoose");
const Movie = require("../../models/Movie");
const { pagination, validateObjectId } = require("../../utils");

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
  if (title) matchStage.title = title;
  if (casts) matchStage.casts = { $regex: new RegExp(casts, "i") };
  if (languages) matchStage.languages = { $regex: new RegExp(languages, "i") };
  if (categoryId) {
    validateObjectId(categoryId, "Category Id");
    matchStage.categoryId = new mongoose.Types.ObjectId(categoryId);
  }
  if (search) {
    const searchRegex = new RegExp(search, "i");
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
