const mm = require("music-metadata");
const fetch = require("node-fetch");

/**
 * Calculates video duration in seconds (supports local path or URL)
 */
exports.calculateVideoDuration = async (videoPath) => {
  try {
    let metadata;
    if (videoPath.startsWith("http")) {
      // For remote video files
      const response = await fetch(videoPath);
      const buffer = await response.arrayBuffer();
      metadata = await mm.parseBuffer(Buffer.from(buffer), null, {
        duration: true,
      });
    } else {
      // For local temp files
      metadata = await mm.parseFile(videoPath);
    }
    return Math.round(metadata.format.duration || 0);
  } catch (error) {
    console.error("Error calculating video duration:", error.message);
    return 0;
  }
};
