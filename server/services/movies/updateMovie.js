const Movie = require("../../models/Movie");
const { validateObjectId, throwError } = require("../../utils");
const { calculateVideoDuration } = require("../../helpers/movies");
const {
  deleteAudioOrVideo,
  deleteImage,
  uploadImage,
  uploadVideo,
} = require("../uploads");

exports.updateMovie = async (movieId, payload, image, video) => {
  validateObjectId(movieId, "movie Id");
  const movie = await Movie.findById(movieId);
  if (!movie || movie.isDeleted) {
    throwError(404, "Movie not found");
  }
  if (payload) {
    Object.keys(payload).forEach((key) => {
      if (
        key !== "_id" &&
        key !== "id" &&
        key !== "createdAt" &&
        key !== "updatedAt"
      ) {
        movie[key] = payload[key];
      }
    });
    await movie.save();
  }
  if (image) {
    if (movie.image) await deleteImage(movie.image);
    movie.image = await uploadImage(image.tempFilePath);
    await movie.save();
  }
  if (video) {
    if (movie.video) await deleteAudioOrVideo(movie.video);
    movie.video = await uploadVideo(video.tempFilePath);
    const durationInSeconds = await calculateVideoDuration(video.tempFilePath);
    movie.duration = durationInSeconds;
    await movie.save();
  }
  return movie;
};
