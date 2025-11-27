const Movie = require("../../models/Movie");
const Category = require("../../models/Category");
const { throwError, validateObjectId } = require("../../utils");
const { calculateVideoDuration } = require("../../helpers/movies");
const { uploadImage, uploadVideo } = require("../uploads");

exports.createMovie = async (payload, image, video) => {
  let {
    title,
    description,
    casts,
    languages,
    categoryId,
    durationInSeconds,
    releaseDate,
    isActive,
  } = payload;
  validateObjectId(categoryId, "category Id");
  const category = await Category.findById(categoryId);
  if (!category || category.isDeleted) {
    throwError(404, "Category not found");
  }
  title = title?.trim()?.toLowerCase();
  description = description?.trim()?.toLowerCase();
  languages = languages?.map((language) => language.trim().toLowerCase());
  if (casts) casts = casts?.map((cast) => cast.trim().toLowerCase());
  const existingMovie = await Movie.findOne({ title, isDeleted: false });
  if (existingMovie) throwError(400, "Movie already exists with this title.");
  let imageUrl, videoUrl;
  if (!video) throwError(422, "movie video file is required");
  videoUrl = await uploadVideo(video.tempFilePath);
  if (image) imageUrl = await uploadImage(image.tempFilePath);
  if (!durationInSeconds && video) {
    durationInSeconds = await calculateVideoDuration(video.tempFilePath);
  }
  return await Movie.create({
    title,
    description,
    casts,
    languages,
    categoryId,
    releaseDate,
    durationInSeconds,
    image: imageUrl,
    video: videoUrl,
    isActive,
  });
};
