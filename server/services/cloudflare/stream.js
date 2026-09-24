const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const tus = require("tus-js-client");

const cloudflare = require("../../configs/cloudflare");

const isCloudflareStreamUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  if (!cloudflare.streamDomain) return false;
  return url.includes(cloudflare.streamDomain);
};

const extractStreamUid = (urlOrUid) => {
  if (!urlOrUid || typeof urlOrUid !== "string") return null;

  if (/^[a-f0-9]{32}$/.test(urlOrUid)) return urlOrUid;

  try {
    const url = new URL(urlOrUid);
    const parts = url.pathname.split("/").filter(Boolean);
    const uid = parts[0];
    if (uid && /^[a-f0-9]{32}$/.test(uid)) return uid;
    return null;
  } catch (e) {
    return null;
  }
};

const createApiClient = () => {
  const accountId = cloudflare.required("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = cloudflare.required("CLOUDFLARE_API_TOKEN");

  return {
    accountId,
    apiToken,
    request: axios.create({
      baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`,
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    }),
  };
};

const parseUidFromTusUrl = (uploadUrl) => {
  if (!uploadUrl || typeof uploadUrl !== "string") return null;
  const clean = uploadUrl.split("?")[0];
  const parts = clean.split("/").filter(Boolean);
  const uid = parts[parts.length - 1];
  if (uid && /^[a-f0-9]{32}$/.test(uid)) return uid;
  return null;
};

const uploadViaTus = async (videoPath) => {
  const { accountId, apiToken } = createApiClient();
  const fileSize = fs.statSync(videoPath).size;
  const ext = path.extname(videoPath)?.toLowerCase();
  const filetype = ext === ".mp4" ? "video/mp4" : "application/octet-stream";

  return await new Promise((resolve, reject) => {
    const upload = new tus.Upload(fs.createReadStream(videoPath), {
      endpoint: `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`,
      uploadSize: fileSize,
      chunkSize: 8 * 1024 * 1024,
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      retryDelays: [0, 1000, 3000, 5000],
      metadata: {
        filename: path.basename(videoPath),
        filetype,
      },
      onError: (err) => reject(err),
      onSuccess: () => {
        const uid = parseUidFromTusUrl(upload.url);
        if (!uid)
          return reject(new Error("Cloudflare TUS upload did not return uid"));
        resolve({ uid, url: buildWatchUrl(uid) });
      },
    });
    upload.start();
  });
};

const buildWatchUrl = (uid) =>
  `https://${cloudflare.required("CLOUDFLARE_STREAM_DOMAIN")}/${uid}/watch`;

const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNABORTED",
  "EPIPE",
  "EAI_AGAIN",
  "ENOTFOUND",
]);

const isRetryableError = (err) => {
  const status = err?.response?.status;
  if (status) return status >= 500 || status === 429;
  return RETRYABLE_NETWORK_CODES.has(err?.code);
};

const uploadViaForm = async (videoPath) => {
  const { request } = createApiClient();
  const form = new FormData();
  form.append("file", fs.createReadStream(videoPath), {
    filename: path.basename(videoPath),
  });
  const res = await request.post("", form, {
    headers: {
      ...form.getHeaders(),
    },
  });
  if (!res?.data?.success) {
    throw new Error(
      res?.data?.errors?.[0]?.message || "Cloudflare Stream upload failed",
    );
  }
  const uid = res.data.result?.uid;
  if (!uid) throw new Error("Cloudflare Stream upload did not return uid");
  return { uid, url: buildWatchUrl(uid) };
};

exports.uploadStreamVideo = async (videoPath) => {
  createApiClient();

  if (!videoPath) throw new Error("videoPath is required");
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const fileSize = fs.statSync(videoPath).size;
  const LARGE_FILE_THRESHOLD_BYTES = 150 * 1024 * 1024;
  if (fileSize >= LARGE_FILE_THRESHOLD_BYTES) {
    return await uploadViaTus(videoPath);
  }

  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; ; attempt++) {
    try {
      return await uploadViaForm(videoPath);
    } catch (err) {
      if (err?.response?.status === 413) return await uploadViaTus(videoPath);
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        throw new Error(
          "Cloudflare Stream rejected the API token (check CLOUDFLARE_API_TOKEN)",
        );
      }
      if (!isRetryableError(err)) throw err;
      if (attempt >= MAX_ATTEMPTS) {
        // Last resort: chunked + resumable upload survives flaky connections.
        console.warn(`Stream form upload failed ${attempt}x, trying TUS`);
        return await uploadViaTus(videoPath);
      }
      console.warn(
        `Stream upload attempt ${attempt} failed (${err.code || err.response?.status}), retrying`,
      );
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
};

/**
 * Creates a one-time TUS upload URL so the admin panel can upload a (GB)
 * video directly to Cloudflare, without passing through this server.
 */
exports.createDirectUpload = async ({ fileSize, fileName, maxDurationSeconds }) => {
  const { accountId, apiToken } = createApiClient();
  const b64 = (value) => Buffer.from(String(value)).toString("base64");
  const metadata = [`maxDurationSeconds ${b64(maxDurationSeconds)}`];
  if (fileName) metadata.push(`name ${b64(fileName)}`);

  const res = await axios.post(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`,
    null,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Tus-Resumable": "1.0.0",
        "Upload-Length": String(fileSize),
        "Upload-Metadata": metadata.join(","),
      },
      validateStatus: () => true,
    },
  );
  const uploadURL = res.headers?.location;
  const uid = res.headers?.["stream-media-id"] || parseUidFromTusUrl(uploadURL);
  if (res.status !== 201 || !uploadURL || !uid) {
    const message =
      res.data?.errors?.[0]?.message ||
      (typeof res.data === "string" && res.data) ||
      `Cloudflare direct upload failed with status ${res.status}`;
    const error = new Error(message);
    error.status = res.status === 401 || res.status === 403 ? 502 : 400;
    throw error;
  }
  return { uid, uploadURL, videoUrl: buildWatchUrl(uid) };
};

/**
 * Returns Cloudflare's view of a video, or null if it doesn't exist.
 */
exports.getStreamVideo = async (urlOrUid) => {
  const uid = extractStreamUid(urlOrUid);
  if (!uid) return null;
  const { request } = createApiClient();
  const res = await request.get(`/${uid}`, { validateStatus: () => true });
  if (res.status === 404) return null;
  if (!res?.data?.success) {
    throw new Error(
      res?.data?.errors?.[0]?.message || "Cloudflare Stream lookup failed",
    );
  }
  const video = res.data.result;
  return {
    uid,
    url: buildWatchUrl(uid),
    state: video.status?.state,
    errorReason: video.status?.errorReasonText || null,
    pctComplete: video.status?.pctComplete ?? null,
    readyToStream: Boolean(video.readyToStream),
    durationInSeconds: video.duration > 0 ? Math.round(video.duration) : null,
    size: video.size ?? null,
  };
};

exports.deleteStreamVideo = async (urlOrUid) => {
  const { request } = createApiClient();
  const uid = extractStreamUid(urlOrUid);
  if (!uid) return false;
  const res = await request.delete(`/${uid}`);
  if (!res?.data?.success) {
    return false;
  }
  return true;
};

exports.isCloudflareStreamUrl = isCloudflareStreamUrl;
exports.extractStreamUid = extractStreamUid;
