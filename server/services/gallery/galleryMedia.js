const path = require("path");
const GalleryItem = require("../../models/GalleryItem");
const { throwError, validateObjectId } = require("../../utils");
const {
  GALLERY_MEDIA_TYPES,
  GALLERY_LIMITS,
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_VIDEO_EXTENSIONS,
} = require("../../constants");
const { calculateVideoDuration } = require("../../helpers/movies");
const {
  getStreamVideo,
  extractStreamUid,
  isCloudflareStreamUrl,
} = require("../cloudflare/stream");
const { isCloudflareImageUrl } = require("../cloudflare/images");
const {
  uploadImage,
  uploadVideo,
  deleteImage,
  deleteAudioOrVideo,
} = require("../uploads");

const { IMAGE, GIF, VIDEO } = GALLERY_MEDIA_TYPES;
const MAX_IMAGE_SIZE_BYTES = GALLERY_LIMITS.MAX_IMAGE_SIZE_MB * 1024 * 1024;
const THUMBNAIL_VARIANT = "thumbnail";

const toFileList = (files) => {
  if (!files) return [];
  return Array.isArray(files) ? files : [files];
};

const detectMediaType = (file) => {
  const ext = path.extname(file?.name || "").toLowerCase();
  if (ext === ".gif") return GIF;
  if (ALLOWED_IMAGE_EXTENSIONS.includes(ext)) return IMAGE;
  if (ALLOWED_VIDEO_EXTENSIONS.includes(ext)) return VIDEO;
  return null;
};

/**
 * Checks a gallery media file before anything is uploaded and returns its
 * media type (image / gif / video).
 */
const assertMediaFile = (file, { allowVideo = true } = {}) => {
  if (Array.isArray(file)) throwError(422, "Only one media file is allowed");
  const mediaType = detectMediaType(file);
  const allowed = allowVideo
    ? [...ALLOWED_IMAGE_EXTENSIONS, ...ALLOWED_VIDEO_EXTENSIONS]
    : ALLOWED_IMAGE_EXTENSIONS;
  if (!mediaType || (mediaType === VIDEO && !allowVideo)) {
    throwError(
      422,
      `Invalid media file ${file?.name || ""}. Allowed: ${allowed.join(", ")}`,
    );
  }
  if (mediaType !== VIDEO && file.size > MAX_IMAGE_SIZE_BYTES) {
    throwError(
      422,
      mediaType === GIF
        ? `GIF ${file.name} is larger than ${GALLERY_LIMITS.MAX_IMAGE_SIZE_MB} MB. Upload it as a video (mp4) instead`
        : `Image ${file.name} is larger than ${GALLERY_LIMITS.MAX_IMAGE_SIZE_MB} MB`,
    );
  }
  return mediaType;
};

const assertPosterFile = (file) => {
  if (Array.isArray(file)) throwError(422, "Only one poster file is allowed");
  if (detectMediaType(file) !== IMAGE) {
    throwError(
      422,
      `Invalid poster file. Allowed: ${ALLOWED_IMAGE_EXTENSIONS.filter((e) => e !== ".gif").join(", ")}`,
    );
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throwError(
      422,
      `Poster must be ${GALLERY_LIMITS.MAX_IMAGE_SIZE_MB} MB or smaller`,
    );
  }
};

/**
 * Uploads a checked media file and returns its URL (and duration for videos).
 */
const uploadMediaFile = async (file, mediaType) => {
  if (mediaType !== VIDEO) {
    return { media: await uploadImage(file.tempFilePath) };
  }
  const durationInSeconds = await calculateVideoDuration(file.tempFilePath);
  const media = await uploadVideo(file.tempFilePath);
  return { media, durationInSeconds: durationInSeconds || null };
};

/**
 * Validates a video that was uploaded directly to Cloudflare Stream
 * (direct upload flow) and returns its details.
 */
const getLinkableStreamVideo = async (videoUid, excludeItemId) => {
  const streamVideo = await getStreamVideo(videoUid);
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
  const filter = { media: streamVideo.url, isDeleted: false };
  if (excludeItemId) filter._id = { $ne: excludeItemId };
  if (await GalleryItem.exists(filter)) {
    throwError(400, "This video is already linked to another gallery item");
  }
  return streamVideo;
};

/**
 * Best-effort delete of stored files (images or Stream videos), e.g. rolling
 * back uploads of a failed request or removing replaced files.
 */
const deleteFiles = async (urls = []) => {
  const results = await Promise.allSettled(
    urls
      .filter(Boolean)
      .map((url) =>
        isCloudflareStreamUrl(url) ? deleteAudioOrVideo(url) : deleteImage(url),
      ),
  );
  results
    .filter((r) => r.status === "rejected")
    .forEach((r) => console.error("Gallery file delete failed:", r.reason));
};

const findGalleryItem = async (id, filter = {}) => {
  validateObjectId(id, "Gallery item Id");
  const item = await GalleryItem.findOne({ _id: id, isDeleted: false, ...filter });
  if (!item) throwError(404, "Gallery item not found");
  return item;
};

// https://imagedelivery.net/<hash>/<id>/public -> .../<id>/thumbnail
const toThumbnailVariant = (url) => {
  if (!isCloudflareImageUrl(url)) return url || null;
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 3) return url;
  parts[parts.length - 1] = THUMBNAIL_VARIANT;
  parsed.pathname = `/${parts.join("/")}`;
  return parsed.toString();
};

const toStreamUrl = (watchUrl, suffix) => {
  const uid = extractStreamUid(watchUrl);
  if (!uid) return null;
  try {
    return `${new URL(watchUrl).origin}/${uid}/${suffix}`;
  } catch (e) {
    return null;
  }
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildDateRange = (fromDate, toDate) => {
  if (!fromDate && !toDate) return undefined;
  const range = {};
  if (fromDate) range.$gte = new Date(fromDate);
  if (toDate) {
    const d = new Date(toDate);
    d.setHours(23, 59, 59, 999);
    range.$lte = d;
  }
  return range;
};

/**
 * Response shape for app / web / admin. Adds ready-to-use URLs (thumbnail,
 * HLS, default poster) that are derived, not stored. Internal fields are only
 * sent to the admin panel.
 */
const toGalleryItemView = (doc, { admin = false } = {}) => {
  const item = doc?.toObject ? doc.toObject() : doc;
  const isVideo = item.mediaType === VIDEO;
  const autoPoster = isVideo
    ? toStreamUrl(item.media, "thumbnails/thumbnail.jpg")
    : null;
  const poster = isVideo ? item.poster || autoPoster : null;
  const view = {
    _id: item._id,
    title: item.title || "",
    description: item.description || "",
    mediaType: item.mediaType,
    media: item.media,
    hlsUrl: isVideo ? toStreamUrl(item.media, "manifest/video.m3u8") : null,
    poster,
    thumbnailUrl: isVideo
      ? item.poster
        ? toThumbnailVariant(item.poster)
        : autoPoster
      : toThumbnailVariant(item.media),
    durationInSeconds: isVideo ? item.durationInSeconds ?? null : null,
    tags: item.tags || [],
    order: item.order ?? 0,
    createdAt: item.createdAt,
  };
  if (!admin) return view;
  return {
    ...view,
    hasCustomPoster: isVideo && Boolean(item.poster),
    isActive: item.isActive,
    createdBy: item.createdBy ?? null,
    updatedAt: item.updatedAt,
  };
};

module.exports = {
  toFileList,
  detectMediaType,
  assertMediaFile,
  assertPosterFile,
  uploadMediaFile,
  getLinkableStreamVideo,
  deleteFiles,
  findGalleryItem,
  escapeRegex,
  buildDateRange,
  toGalleryItemView,
};
