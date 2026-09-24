const fs = require("fs");

const collectTempPaths = (files) => {
  if (!files) return [];
  return Object.values(files)
    .flat()
    .map((file) => file?.tempFilePath)
    .filter(Boolean);
};

/**
 * Deletes express-fileupload temp files once the response is finished
 * (success or error), so uploaded videos/images don't pile up on disk.
 */
exports.cleanupTempFiles = (req, res, next) => {
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    collectTempPaths(req.files).forEach((tempPath) => {
      fs.unlink(tempPath, (err) => {
        if (err && err.code !== "ENOENT") {
          console.error("Temp file cleanup failed:", tempPath, err.message);
        }
      });
    });
  };
  res.on("finish", cleanup);
  res.on("close", cleanup);
  next();
};
