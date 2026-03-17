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
  const streamDomain = cloudflare.required("CLOUDFLARE_STREAM_DOMAIN");
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
        resolve({ uid, url: `https://${streamDomain}/${uid}/watch` });
      },
    });
    upload.start();
  });
};

exports.uploadStreamVideo = async (videoPath) => {
  const { request } = createApiClient();

  if (!videoPath) throw new Error("videoPath is required");
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const fileSize = fs.statSync(videoPath).size;
  const LARGE_FILE_THRESHOLD_BYTES = 150 * 1024 * 1024;
  if (fileSize >= LARGE_FILE_THRESHOLD_BYTES) {
    return await uploadViaTus(videoPath);
  }

  const form = new FormData();
  form.append("file", fs.createReadStream(videoPath), {
    filename: path.basename(videoPath),
  });

  try {
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

    const streamDomain = cloudflare.required("CLOUDFLARE_STREAM_DOMAIN");
    return {
      uid,
      url: `https://${streamDomain}/${uid}/watch`,
    };
  } catch (err) {
    const status = err?.response?.status;
    if (status === 413) {
      return await uploadViaTus(videoPath);
    }
    throw err;
  }
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
