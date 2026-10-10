/**
 * Manual test helper: uploads a (GB) video the same way the admin panel does.
 *
 *   node scripts/upload-video.js <video-file> [api-base-url]
 *
 * 1. POST /movies/video/upload-url  -> one-time Cloudflare upload URL + uid
 * 2. Resumable TUS upload straight to Cloudflare (50 MB chunks, retries)
 * 3. Prints the videoUid to use in POST /movies/add
 */
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const tus = require("tus-js-client");

const [, , filePath, apiBase = "https://iftv-ott.onrender.com/iftv-ott"] =
  process.argv;

if (!filePath || !fs.existsSync(filePath)) {
  console.error("Usage: node scripts/upload-video.js <video-file> [api-base-url]");
  process.exit(1);
}

(async () => {
  const fileSize = fs.statSync(filePath).size;
  const fileName = path.basename(filePath);
  console.log(`File: ${fileName} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);

  const { data } = await axios.post(`${apiBase}/movies/video/upload-url`, {
    fileSize,
    fileName,
  });
  const { uid, uploadURL } = data.data;
  console.log(`videoUid: ${uid}`);

  const started = Date.now();
  let lastPct = -1;
  await new Promise((resolve, reject) => {
    const upload = new tus.Upload(fs.createReadStream(filePath), {
      uploadUrl: uploadURL,
      uploadSize: fileSize,
      chunkSize: 50 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
      onProgress: (sent, total) => {
        const pct = Math.floor((sent / total) * 100);
        if (pct !== lastPct) {
          lastPct = pct;
          process.stdout.write(`\rUploading... ${pct}%`);
        }
      },
      onError: reject,
      onSuccess: resolve,
    });
    upload.start();
  });

  const secs = Math.round((Date.now() - started) / 1000);
  console.log(`\nUpload done in ${secs}s`);
  console.log(`Status: GET ${apiBase}/movies/video/${uid}/status`);
  console.log(`Now create the movie with videoUid=${uid}`);
})().catch((err) => {
  console.error("\nFailed:", err.response?.data || err.message);
  process.exit(1);
});
