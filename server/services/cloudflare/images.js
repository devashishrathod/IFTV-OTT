const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

const cloudflare = require("../../configs/cloudflare");
const { throwError } = require("../../utils");
const { isRetryableError } = require("./stream");

const IMAGE_DELIVERY_HOST = "imagedelivery.net";
const DEFAULT_VARIANT = "public";
// Cloudflare Images rejects files above 10 MB.
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const isCloudflareImageUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  try {
    return new URL(url).hostname === IMAGE_DELIVERY_HOST;
  } catch (e) {
    return false;
  }
};

// https://imagedelivery.net/<account hash>/<image id>/<variant>
const extractImageId = (url) => {
  if (!isCloudflareImageUrl(url)) return null;
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  return parts[1] || null;
};

const createApiClient = () => {
  const accountId = cloudflare.required("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = cloudflare.required("CLOUDFLARE_API_TOKEN");

  return axios.create({
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
};

const cloudflareErrorMessage = (err) =>
  err?.response?.data?.errors?.[0]?.message || err?.message;

const uploadViaForm = async (imagePath) => {
  const form = new FormData();
  form.append("file", fs.createReadStream(imagePath), {
    filename: path.basename(imagePath),
  });
  const res = await createApiClient().post("", form, {
    headers: {
      ...form.getHeaders(),
    },
  });
  if (!res?.data?.success) {
    throw new Error(
      res?.data?.errors?.[0]?.message || "Cloudflare Images upload failed",
    );
  }
  const variants = res.data.result?.variants || [];
  const url =
    variants.find((v) => v.endsWith(`/${DEFAULT_VARIANT}`)) || variants[0];
  if (!url) throw new Error("Cloudflare Images upload did not return a URL");
  return url;
};

exports.uploadCloudflareImage = async (imagePath) => {
  if (!imagePath) throw new Error("imagePath is required");
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }
  if (fs.statSync(imagePath).size > MAX_IMAGE_SIZE_BYTES) {
    throwError(422, "Image must be 10 MB or smaller");
  }

  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; ; attempt++) {
    try {
      return await uploadViaForm(imagePath);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        throw new Error(
          "Cloudflare Images rejected the API token (check CLOUDFLARE_API_TOKEN)",
        );
      }
      // e.g. a file that is not a supported image
      if (status === 400 || status === 413 || status === 415) {
        throwError(422, `Invalid image: ${cloudflareErrorMessage(err)}`);
      }
      if (!isRetryableError(err) || attempt >= MAX_ATTEMPTS) throw err;
      console.warn(
        `Image upload attempt ${attempt} failed (${err.code || status}), retrying`,
      );
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
};

/**
 * Deletes an image by its delivery URL. Returns true when the image is gone
 * (also when it was already deleted), false otherwise. Never throws, like the
 * Cloudinary deleteFile, so a failed cleanup doesn't break the caller.
 */
exports.deleteCloudflareImage = async (url) => {
  const imageId = extractImageId(url);
  if (!imageId) return false;
  try {
    const res = await createApiClient().delete(`/${imageId}`, {
      validateStatus: () => true,
    });
    if (res.status === 404) return true;
    if (!res?.data?.success) {
      console.error("Cloudflare image delete failed:", {
        imageId,
        status: res.status,
        error: res?.data?.errors?.[0]?.message,
      });
      return false;
    }
    return true;
  } catch (err) {
    console.error("Cloudflare image delete error:", err.message);
    return false;
  }
};

exports.isCloudflareImageUrl = isCloudflareImageUrl;
exports.extractImageId = extractImageId;
