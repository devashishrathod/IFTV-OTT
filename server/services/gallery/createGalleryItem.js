const GalleryItem = require("../../models/GalleryItem");
const { GALLERY_MEDIA_TYPES } = require("../../constants");
const { throwError } = require("../../utils");
const { uploadImage } = require("../uploads");
const {
  assertMediaFile,
  assertPosterFile,
  uploadMediaFile,
  getLinkableStreamVideo,
  deleteFiles,
  toGalleryItemView,
} = require("./galleryMedia");

exports.createGalleryItem = async (payload, { media, poster }, userId) => {
  const { videoUid, ...fields } = payload;

  // Media comes either as a file (image / gif / small video) or as a
  // Cloudflare Stream uid from the direct upload flow (large / GB videos).
  if (!media && !videoUid) {
    throwError(422, "media file or videoUid is required");
  }
  if (media && videoUid) {
    throwError(422, "Send either a media file or videoUid, not both");
  }
  const mediaType = media ? assertMediaFile(media) : GALLERY_MEDIA_TYPES.VIDEO;
  if (poster) {
    if (mediaType !== GALLERY_MEDIA_TYPES.VIDEO) {
      throwError(422, "Poster is allowed only for videos");
    }
    assertPosterFile(poster);
  }

  const uploaded = [];
  try {
    let mediaUrl;
    let durationInSeconds = null;
    if (media) {
      const result = await uploadMediaFile(media, mediaType);
      uploaded.push(result.media);
      mediaUrl = result.media;
      durationInSeconds = result.durationInSeconds ?? null;
    } else {
      const streamVideo = await getLinkableStreamVideo(videoUid);
      mediaUrl = streamVideo.url;
      durationInSeconds = streamVideo.durationInSeconds;
    }
    let posterUrl = null;
    if (poster) {
      posterUrl = await uploadImage(poster.tempFilePath);
      uploaded.push(posterUrl);
    }

    const item = await GalleryItem.create({
      ...fields,
      mediaType,
      media: mediaUrl,
      poster: posterUrl,
      durationInSeconds,
      createdBy: userId,
    });
    return toGalleryItemView(item, { admin: true });
  } catch (err) {
    // Don't leave orphan files on Cloudflare
    await deleteFiles(uploaded);
    throw err;
  }
};
