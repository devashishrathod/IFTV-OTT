const Movie = require("../../models/Movie");
const Category = require("../../models/Category");
const { validateObjectId, throwError } = require("../../utils");
const { calculateVideoDuration } = require("../../helpers/movies");
const { uploadImage, uploadVideo } = require("../uploads");
const {
  assertVideoFile,
  assertImageFile,
  ensureUniqueTitle,
  getLinkableStreamVideo,
  deleteMedia,
} = require("./movieMedia");

const PROTECTED_KEYS = ["_id", "id", "createdAt", "updatedAt"];

exports.updateMovie = async (movieId, payload = {}, image, video) => {
  validateObjectId(movieId, "movie Id");
  const movie = await Movie.findById(movieId);
  if (!movie || movie.isDeleted) {
    throwError(404, "Movie not found");
  }
  const { videoUid, videoUrl, ...fields } = payload;
  const streamRef = videoUid || videoUrl;
  if (video && streamRef) {
    throwError(422, "Send either a video file or videoUid, not both");
  }
  if (video) assertVideoFile(video);
  if (image) assertImageFile(image);

  if (fields.title) {
    fields.title = fields.title.trim();
    await ensureUniqueTitle(fields.title, movie._id);
  }
  if (typeof fields.description === "string") {
    fields.description = fields.description.trim();
  }
  if (fields.languages) {
    fields.languages = fields.languages.map((l) => l.trim().toLowerCase());
  }
  if (fields.casts) {
    fields.casts = fields.casts.map((c) => c.trim().toLowerCase());
  }
  if (fields.categoryId) {
    const category = await Category.findById(fields.categoryId);
    if (!category || category.isDeleted) throwError(404, "Category not found");
  }
  Object.keys(fields).forEach((key) => {
    if (!PROTECTED_KEYS.includes(key)) movie[key] = fields[key];
  });

  const uploaded = {};
  const replaced = {};
  try {
    if (image) {
      uploaded.image = await uploadImage(image.tempFilePath);
      replaced.image = movie.image;
      movie.image = uploaded.image;
    }
    if (video) {
      const durationInSeconds =
        fields.durationInSeconds ||
        (await calculateVideoDuration(video.tempFilePath));
      uploaded.video = await uploadVideo(video.tempFilePath);
      replaced.video = movie.video;
      movie.video = uploaded.video;
      movie.durationInSeconds = durationInSeconds;
    } else if (streamRef) {
      const streamVideo = await getLinkableStreamVideo(streamRef, movie._id);
      if (streamVideo.url !== movie.video) {
        replaced.video = movie.video;
        movie.video = streamVideo.url;
      }
      if (!fields.durationInSeconds) {
        movie.durationInSeconds = streamVideo.durationInSeconds ?? null;
      }
    }
    await movie.save();
  } catch (err) {
    await deleteMedia(uploaded);
    throw err;
  }
  // Remove old files only after the new ones are safely saved
  await deleteMedia(replaced);
  return movie;
};
