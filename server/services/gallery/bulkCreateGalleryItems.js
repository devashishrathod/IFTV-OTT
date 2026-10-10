const GalleryItem = require("../../models/GalleryItem");
const { GALLERY_LIMITS } = require("../../constants");
const { throwError } = require("../../utils");
const { uploadImage } = require("../uploads");
const {
  toFileList,
  assertMediaFile,
  deleteFiles,
  toGalleryItemView,
} = require("./galleryMedia");

/**
 * Uploads up to MAX_BULK_FILES images / gifs as separate gallery items.
 * All or nothing: every file is checked first, and if any upload or the save
 * fails, the files that did upload are deleted again.
 */
exports.bulkCreateGalleryItems = async (payload, files, userId) => {
  const list = toFileList(files);
  if (!list.length) throwError(422, "At least one media file is required");
  if (list.length > GALLERY_LIMITS.MAX_BULK_FILES) {
    throwError(
      422,
      `Maximum ${GALLERY_LIMITS.MAX_BULK_FILES} files can be uploaded at once`,
    );
  }
  const mediaTypes = list.map((file) =>
    assertMediaFile(file, { allowVideo: false }),
  );

  const results = await Promise.allSettled(
    list.map((file) => uploadImage(file.tempFilePath)),
  );
  const urls = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);
  const failed = results.find((r) => r.status === "rejected");
  if (failed) {
    await deleteFiles(urls);
    throw failed.reason;
  }

  try {
    const items = await GalleryItem.insertMany(
      urls.map((url, index) => ({
        ...payload,
        mediaType: mediaTypes[index],
        media: url,
        createdBy: userId,
      })),
    );
    return {
      count: items.length,
      items: items.map((item) => toGalleryItemView(item, { admin: true })),
    };
  } catch (err) {
    await deleteFiles(urls);
    throw err;
  }
};
