const Movie = require("../../models/Movie");
const Category = require("../../models/Category");
const { throwError, validateObjectId } = require("../../utils");
const { calculateVideoDuration } = require("../../helpers/movies");
const { uploadImage, uploadVideo } = require("../uploads");
const {
  assertVideoFile,
  assertImageFile,
  ensureUniqueTitle,
  getLinkableStreamVideo,
  deleteMedia,
} = require("./movieMedia");

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
    videoUid,
    videoUrl,
  } = payload;
  validateObjectId(categoryId, "category Id");
  const category = await Category.findById(categoryId);
  if (!category || category.isDeleted) {
    throwError(404, "Category not found");
  }
  title = title?.trim();
  description = description?.trim();
  languages = languages?.map((language) => language.trim().toLowerCase());
  if (casts) casts = casts?.map((cast) => cast.trim().toLowerCase());
  await ensureUniqueTitle(title);

  // Video comes either as a file (small videos) or as a Cloudflare Stream
  // uid/url from the direct upload flow (large / GB videos).
  const streamRef = videoUid || videoUrl;
  if (!video && !streamRef) {
    throwError(422, "movie video file or videoUid is required");
  }
  if (video && streamRef) {
    throwError(422, "Send either a video file or videoUid, not both");
  }
  if (video) assertVideoFile(video);
  if (image) assertImageFile(image);

  const uploaded = {};
  try {
    let movieVideoUrl;
    if (video) {
      if (!durationInSeconds) {
        durationInSeconds = await calculateVideoDuration(video.tempFilePath);
      }
      uploaded.video = await uploadVideo(video.tempFilePath);
      movieVideoUrl = uploaded.video;
    } else {
      const streamVideo = await getLinkableStreamVideo(streamRef);
      movieVideoUrl = streamVideo.url;
      if (!durationInSeconds) {
        durationInSeconds = streamVideo.durationInSeconds ?? undefined;
      }
    }
    if (image) uploaded.image = await uploadImage(image.tempFilePath);

    return await Movie.create({
      title,
      description,
      casts,
      languages,
      categoryId,
      releaseDate,
      durationInSeconds,
      image: uploaded.image,
      video: movieVideoUrl,
      isActive,
    });
  } catch (err) {
    // Don't leave orphan files on Cloudflare/Cloudinary
    await deleteMedia(uploaded);
    throw err;
  }
};
