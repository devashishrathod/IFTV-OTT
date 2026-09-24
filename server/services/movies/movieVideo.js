const { throwError } = require("../../utils");
const { STREAM_MAX_DURATION_SECONDS } = require("../../constants");
const { createDirectUpload, getStreamVideo } = require("../cloudflare/stream");

// Cloudflare TUS uploads are limited to 30 GB per file
const MAX_DIRECT_UPLOAD_BYTES = 30 * 1024 * 1024 * 1024;

exports.createVideoUploadUrl = async ({
  fileSize,
  fileName,
  maxDurationSeconds = STREAM_MAX_DURATION_SECONDS,
}) => {
  if (fileSize > MAX_DIRECT_UPLOAD_BYTES) {
    throwError(422, "Video cannot be bigger than 30 GB");
  }
  return await createDirectUpload({ fileSize, fileName, maxDurationSeconds });
};

exports.getVideoStatus = async (uid) => {
  const video = await getStreamVideo(uid);
  if (!video) throwError(404, "Video not found on Cloudflare Stream");
  return video;
};
