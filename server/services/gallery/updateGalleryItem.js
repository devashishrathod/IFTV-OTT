const { GALLERY_MEDIA_TYPES } = require("../../constants");
const { throwError } = require("../../utils");
const { uploadImage } = require("../uploads");
const {
  assertMediaFile,
  assertPosterFile,
  uploadMediaFile,
  getLinkableStreamVideo,
  deleteFiles,
  findGalleryItem,
  toGalleryItemView,
} = require("./galleryMedia");

const { VIDEO } = GALLERY_MEDIA_TYPES;
const EDITABLE_FIELDS = ["title", "description", "tags", "order", "isActive"];

exports.updateGalleryItem = async (id, payload = {}, { media, poster }) => {
  const item = await findGalleryItem(id);
  const { videoUid, removePoster, ...fields } = payload;

  if (media && videoUid) {
    throwError(422, "Send either a media file or videoUid, not both");
  }
  if (poster && removePoster) {
    throwError(422, "Send either a poster file or removePoster, not both");
  }
  const newMediaType = media
    ? assertMediaFile(media)
    : videoUid
      ? VIDEO
      : null;
  const finalMediaType = newMediaType || item.mediaType;
  if (poster) {
    if (finalMediaType !== VIDEO) {
      throwError(422, "Poster is allowed only for videos");
    }
    assertPosterFile(poster);
  }
  const fieldKeys = EDITABLE_FIELDS.filter((key) => fields[key] !== undefined);
  if (!media && !videoUid && !poster && !removePoster && !fieldKeys.length) {
    throwError(422, "Nothing to update");
  }
  fieldKeys.forEach((key) => {
    item[key] = fields[key];
  });

  const uploaded = [];
  const replaced = [];
  try {
    if (media) {
      const result = await uploadMediaFile(media, newMediaType);
      uploaded.push(result.media);
      replaced.push(item.media);
      item.media = result.media;
      item.mediaType = newMediaType;
      item.durationInSeconds = result.durationInSeconds ?? null;
    } else if (videoUid) {
      const streamVideo = await getLinkableStreamVideo(videoUid, item._id);
      if (streamVideo.url !== item.media) {
        replaced.push(item.media);
        item.media = streamVideo.url;
        item.mediaType = VIDEO;
      }
      item.durationInSeconds = streamVideo.durationInSeconds;
    }
    // Images and gifs never keep a poster
    if ((finalMediaType !== VIDEO || removePoster) && item.poster) {
      replaced.push(item.poster);
      item.poster = null;
    }
    if (poster) {
      const posterUrl = await uploadImage(poster.tempFilePath);
      uploaded.push(posterUrl);
      if (item.poster) replaced.push(item.poster);
      item.poster = posterUrl;
    }
    await item.save();
  } catch (err) {
    await deleteFiles(uploaded);
    throw err;
  }
  // Remove old files only after the new ones are safely saved
  await deleteFiles(replaced);
  return toGalleryItemView(item, { admin: true });
};
