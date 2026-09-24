const mm = require("music-metadata");

/**
 * Calculates video duration in seconds (supports local path or URL)
 */
exports.calculateVideoDuration = async (videoPath) => {
  try {
    let metadata;
    if (videoPath.startsWith("http")) {
      // For remote video files: stream instead of buffering the whole file
      const response = await fetch(videoPath);
      if (!response.ok || !response.body) {
        throw new Error(`Failed to fetch video (${response.status})`);
      }
      metadata = await mm.parseWebStream(
        response.body,
        { mimeType: response.headers.get("content-type") || undefined },
        { duration: true },
      );
      await response.body.cancel().catch(() => {});
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
