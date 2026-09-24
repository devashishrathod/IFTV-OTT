const Movie = require("../../models/Movie");
const { throwError, validateObjectId } = require("../../utils");
const {
  getStreamVideo,
  isCloudflareStreamUrl,
} = require("../cloudflare/stream");

exports.getMovie = async (id) => {
  validateObjectId(id, "Movie Id");
  const result = await Movie.findById(id);
  if (!result || result.isDeleted) throwError(404, "Movie not found");
  // Directly uploaded videos may still be processing when the movie is
  // created; fill the duration in once Cloudflare knows it.
  if (!result.durationInSeconds && isCloudflareStreamUrl(result.video)) {
    try {
      const streamVideo = await getStreamVideo(result.video);
      if (streamVideo?.durationInSeconds) {
        result.durationInSeconds = streamVideo.durationInSeconds;
        await result.save();
      }
    } catch (err) {
      console.error("Duration sync failed:", err.message);
    }
  }
  return result;
};
