const Subscription = require("../../models/Subscription");
const { pagination } = require("../../utils");

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Only these query keys become filters; anything else is ignored.
const FILTER_KEYS = ["name", "type", "isActive"];

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
  } = query;
  const matchStage = { isDeleted: false };
  FILTER_KEYS.forEach((key) => {
    if (query[key] !== undefined && query[key] !== "") {
      matchStage[key] = query[key];
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
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt.$lte = end;
    }
  }
  const searchRegex = search ? new RegExp(escapeRegex(search), "i") : null;
  const pipeline = [
    { $match: matchStage },
    ...(searchRegex
      ? [
          {
            $match: {
              $or: [{ name: searchRegex }, { description: searchRegex }],
            },
          },
        ]
      : []),

    { $sort: { createdAt: -1 } },
  ];
  return pagination(Subscription, pipeline, page, limit);
};
