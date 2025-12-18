const Subscription = require("../../models/Subscription");
const { pagination } = require("../../utils");

exports.getAllSubscription = async (query) => {
  const {
    page = 1,
    limit = 10,
    search,
    price,
    minPrice,
    maxPrice,
    fromDate,
    toDate,
    ...filters
  } = query;
  const matchStage = { isDeleted: false };
  Object.keys(filters).forEach((key) => {
    if (filters[key] !== undefined && filters[key] !== "") {
      matchStage[key] = filters[key];
    }
  });
  if (price !== undefined) {
    matchStage.price = Number(price);
  } else {
    if (minPrice !== undefined || maxPrice !== undefined) {
      matchStage.price = {};
      if (minPrice !== undefined) {
        matchStage.price.$gte = Number(minPrice);
      }
      if (maxPrice !== undefined) {
        matchStage.price.$lte = Number(maxPrice);
      }
    }
  }
  if (fromDate || toDate) {
    matchStage.createdAt = {};
    if (fromDate) {
      matchStage.createdAt.$gte = new Date(fromDate);
    }
    if (toDate) {
      matchStage.createdAt.$lte = new Date(toDate);
    }
  }
  const pipeline = [
    { $match: matchStage },
    ...(search
      ? [
          {
            $match: {
              $or: [
                { name: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
              ],
            },
          },
        ]
      : []),

    { $sort: { createdAt: -1 } },
  ];
  return pagination(Subscription, pipeline, page, limit);
};
