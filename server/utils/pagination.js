const { throwError } = require("./CustomError");

/**
 * `options.allowEmpty` returns an empty page instead of the old 404, for
 * lists where "nothing yet" is a normal state (e.g. a user's payments).
 */
exports.pagination = async (
  model,
  pipeline,
  page = 1,
  limit = 10,
  options = {}
) => {
  page = parseInt(page, 10);
  limit = parseInt(limit, 10);
  const skip = (page - 1) * limit;
  const facetPipeline = [
    ...pipeline,
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: "count" }],
      },
    },
    {
      $project: {
        data: 1,
        totalCount: { $arrayElemAt: ["$totalCount.count", 0] },
      },
    },
  ];
  const result = await model.aggregate(facetPipeline);
  const { data, totalCount = 0 } = result[0] || {};
  if ((!data || data.length === 0) && !options.allowEmpty) {
    const modelName = model.modelName
      ? model.modelName.toLowerCase()
      : "record";
    throwError(404, `No any ${modelName} found`);
  }
  return {
    total: totalCount,
    totalPages: Math.ceil(totalCount / limit),
    page,
    limit,
    data: data || [],
  };
};
