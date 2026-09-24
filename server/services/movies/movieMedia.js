const path = require("path");
const Movie = require("../../models/Movie");
const { throwError } = require("../../utils");
const {
  ALLOWED_VIDEO_EXTENSIONS,
  ALLOWED_IMAGE_EXTENSIONS,
} = require("../../constants");
const { getStreamVideo } = require("../cloudflare/stream");
const { deleteAudioOrVideo, deleteImage } = require("../uploads");

const CASE_INSENSITIVE = { locale: "en", strength: 2 };

const assertFileType = (file, allowedExtensions, mimePrefix, label) => {
  if (Array.isArray(file)) throwError(422, `Only one ${label} file is allowed`);
  const ext = path.extname(file?.name || "").toLowerCase();
  const mimeOk = file?.mimetype?.startsWith(mimePrefix);
  if (!allowedExtensions.includes(ext) && !mimeOk) {
    throwError(
      422,
      `Invalid ${label} file. Allowed: ${allowedExtensions.join(", ")}`,
    );
  }
};

exports.assertVideoFile = (file) =>
  assertFileType(file, ALLOWED_VIDEO_EXTENSIONS, "video/", "video");

exports.assertImageFile = (file) =>
  assertFileType(file, ALLOWED_IMAGE_EXTENSIONS, "image/", "image");

exports.ensureUniqueTitle = async (title, excludeId) => {
  const filter = { title, isDeleted: false };
  if (excludeId) filter._id = { $ne: excludeId };
  const existing = await Movie.findOne(filter).collation(CASE_INSENSITIVE);
  if (existing) throwError(400, "Movie already exists with this title.");
};

/**
 * Validates a video that was uploaded directly to Cloudflare Stream
 * (direct upload flow) and returns its details.
 */
exports.getLinkableStreamVideo = async (uidOrUrl, excludeMovieId) => {
  const streamVideo = await getStreamVideo(uidOrUrl);
  if (!streamVideo) throwError(404, "Video not found on Cloudflare Stream");
  if (streamVideo.state === "pendingupload") {
    throwError(422, "Video upload is not finished yet");
  }
  if (streamVideo.state === "error") {
    throwError(
      422,
      `Cloudflare could not process this video: ${streamVideo.errorReason || "unknown error"}`,
    );
  }
  const filter = { video: streamVideo.url, isDeleted: false };
  if (excludeMovieId) filter._id = { $ne: excludeMovieId };
  if (await Movie.exists(filter)) {
    throwError(400, "This video is already linked to another movie");
  }
  return streamVideo;
};

/**
 * Best-effort delete of stored media, e.g. rolling back uploads of a request
 * that failed, or removing replaced files after an update.
 */
exports.deleteMedia = async ({ video, image }) => {
  const tasks = [];
  if (video) tasks.push(deleteAudioOrVideo(video));
  if (image) tasks.push(deleteImage(image));
  const results = await Promise.allSettled(tasks);
  results
    .filter((r) => r.status === "rejected")
    .forEach((r) => console.error("Media delete failed:", r.reason));
};
