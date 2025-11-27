const Movie = require("../../models/Movie");
const { throwError, validateObjectId } = require("../../utils");

exports.getMovie = async (id) => {
  validateObjectId(id, "Movie Id");
  const result = await Movie.findById(id);
  if (!result || result.isDeleted) throwError(404, "Movie not found");
  return result;
};
