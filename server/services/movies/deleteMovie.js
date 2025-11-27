const Movie = require("../../models/Movie");
const { throwError, validateObjectId } = require("../../utils");
const { deleteAudioOrVideo, deleteImage } = require("../uploads");

exports.deleteMovie = async (id) => {
  validateObjectId(id, "Movie Id");
  const result = await Movie.findById(id);
  if (!result || result.isDeleted) throwError(404, "Movie not found");
  await deleteAudioOrVideo(result?.video);
  await deleteImage(result?.image);
  result.video = null;
  result.image = null;
  result.isDeleted = true;
  result.isActive = false;
  result.updatedAt = new Date();
  await result.save();
  return;
};
