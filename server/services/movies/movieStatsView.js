// 1520 → "1.5K", 2300000 → "2.3M"
const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

exports.toCountLabel = (count) => compact.format(count || 0);

/**
 * What every viewer sees under a movie. The other counters stay in the admin
 * stats APIs.
 */
exports.toPublicStats = (stats = {}) => {
  const views = stats?.views || 0;
  const plays = stats?.plays || 0;
  return {
    views,
    plays,
    viewsLabel: exports.toCountLabel(views),
    playsLabel: exports.toCountLabel(plays),
  };
};

/**
 * All-time counters for the admin panel. Movies saved before stats existed
 * read as zeros.
 */
exports.toAllTimeStats = (stats = {}) => {
  const views = stats?.views || 0;
  const plays = stats?.plays || 0;
  return {
    views,
    uniqueViewers: stats?.uniqueViewers || 0,
    plays,
    uniquePlayers: stats?.uniquePlayers || 0,
    playRate: exports.playRate(plays, views),
    lastViewedAt: stats?.lastViewedAt || null,
    lastPlayedAt: stats?.lastPlayedAt || null,
  };
};

// Plays per 100 views, one decimal. Can pass 100 when plays skip the page.
exports.playRate = (plays, views) =>
  views ? Math.round((plays / views) * 1000) / 10 : 0;

// Replaces stats on one movie or a list with the public shape
exports.withPublicStats = (movies) => {
  const toView = (movie) => ({ ...movie, stats: exports.toPublicStats(movie.stats) });
  return Array.isArray(movies) ? movies.map(toView) : toView(movies);
};
