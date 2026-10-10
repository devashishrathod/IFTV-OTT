const Subscription = require("../../models/Subscription");
const { MOVIE_ACCESS_TYPES } = require("../../constants");
const { throwError } = require("../../utils");

/**
 * Works out accessType / allowedPlans for a movie create or update.
 * A free movie never keeps plan links; plan ids of a paid movie must belong
 * to existing (not deleted) plans. Returns only the fields to save.
 */
exports.resolveAccessFields = async ({ accessType, allowedPlans }, movie) => {
  const finalType =
    accessType || movie?.accessType || MOVIE_ACCESS_TYPES.FREE;
  const result = {};
  if (accessType) result.accessType = accessType;
  if (finalType === MOVIE_ACCESS_TYPES.FREE) {
    if (allowedPlans !== undefined || movie?.allowedPlans?.length) {
      result.allowedPlans = [];
    }
    return result;
  }
  if (allowedPlans !== undefined) {
    const ids = [...new Set(allowedPlans.map(String))];
    if (ids.length) {
      const found = await Subscription.countDocuments({
        _id: { $in: ids },
        isDeleted: false,
      });
      if (found !== ids.length) {
        throwError(422, "One or more plans in allowedPlans were not found");
      }
    }
    result.allowedPlans = ids;
  }
  return result;
};
