const path = require("path");
const { SUPPORT_LIMITS } = require("../../constants");
const { throwError } = require("../../utils");
const { uploadImage, deleteImage } = require("../uploads");

const {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_SIZE_MB,
  ALLOWED_ATTACHMENT_EXTENSIONS,
  ALLOWED_ATTACHMENT_MIME_TYPES,
} = SUPPORT_LIMITS;

const toFileList = (files) => {
  if (!files) return [];
  return Array.isArray(files) ? files : [files];
};

/**
 * Checks count, type and size of every attachment before anything is
 * uploaded. Returns the files as a list.
 */
const assertAttachments = (files) => {
  const list = toFileList(files);
  if (list.length > MAX_ATTACHMENTS) {
    throwError(422, `Maximum ${MAX_ATTACHMENTS} attachments are allowed`);
  }
  list.forEach((file) => {
    const ext = path.extname(file?.name || "").toLowerCase();
    if (
      !ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext) ||
      !ALLOWED_ATTACHMENT_MIME_TYPES.includes(file?.mimetype)
    ) {
      throwError(
        422,
        `Invalid attachment ${file?.name}. Allowed: ${ALLOWED_ATTACHMENT_EXTENSIONS.join(", ")}`,
      );
    }
    if (file.size > MAX_ATTACHMENT_SIZE_MB * 1024 * 1024) {
      throwError(
        422,
        `Attachment ${file.name} is larger than ${MAX_ATTACHMENT_SIZE_MB} MB`,
      );
    }
  });
  return list;
};

/**
 * Best-effort delete, e.g. rolling back uploads of a request that failed.
 */
const deleteAttachments = async (urls = []) => {
  await Promise.allSettled(urls.map((url) => deleteImage(url)));
};

/**
 * Uploads the attachments and returns their URLs. If any upload fails, the
 * ones that did upload are deleted again so nothing is left behind.
 */
const uploadAttachments = async (files) => {
  const list = assertAttachments(files);
  const results = await Promise.allSettled(
    list.map((file) => uploadImage(file.tempFilePath)),
  );
  const urls = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);
  const failed = results.find((r) => r.status === "rejected");
  if (failed) {
    await deleteAttachments(urls);
    throw failed.reason;
  }
  return urls;
};

module.exports = { assertAttachments, uploadAttachments, deleteAttachments };
