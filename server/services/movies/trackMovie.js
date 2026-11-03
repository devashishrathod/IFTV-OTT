const Movie = require("../../models/Movie");
const MovieViewer = require("../../models/MovieViewer");
const MovieActivity = require("../../models/MovieActivity");
const {
  ROLES,
  MOVIE_EVENTS,
  MOVIE_ACCESS_TYPES,
  MOVIE_VIEWER_TYPES,
  MOVIE_TRACK_SKIP_REASONS,
  MOVIE_STATS_LIMITS,
} = require("../../constants");
const { throwError, validateObjectId } = require("../../utils");
const { applyMovieAccess } = require("../subscriptions/movieAccess");
const { getCurrentPeriod } = require("../subscriptions/periods");
const { startOfDay } = require("../dashboard/dateRange");
const { toPublicStats } = require("./movieStatsView");

const PRIVILEGED_ROLES = [ROLES.ADMIN, ROLES.STAFF];
const DUPLICATE_KEY = 11000;
const REPEAT_WINDOW_MS = MOVIE_STATS_LIMITS.REPEAT_WINDOW_MINUTES * 60 * 1000;

// Counter, last-time and unique counter each event moves
const EVENT_FIELDS = Object.freeze({
  [MOVIE_EVENTS.VIEW]: { count: "views", lastAt: "lastViewedAt", unique: "uniqueViewers" },
  [MOVIE_EVENTS.PLAY]: { count: "plays", lastAt: "lastPlayedAt", unique: "uniquePlayers" },
});

const viewerOf = async (user, deviceId) => {
  if (!user) {
    return {
      viewerKey: `device:${deviceId}`,
      userId: null,
      deviceId,
      viewerType: MOVIE_VIEWER_TYPES.GUEST,
    };
  }
  const current = await getCurrentPeriod(user._id);
  return {
    viewerKey: `user:${user._id}`,
    userId: user._id,
    deviceId: deviceId || null,
    viewerType: current ? MOVIE_VIEWER_TYPES.SUBSCRIBER : MOVIE_VIEWER_TYPES.USER,
  };
};

/**
 * Bumps the viewer's all-time row unless the same event was counted inside
 * the repeat window. Returns null for a repeat, else { isFirst } (the
 * viewer's first event of this kind on the movie).
 */
const countForViewer = async (movieId, viewer, fields, platform, now) => {
  const { viewerKey, userId, deviceId, viewerType } = viewer;
  const cutoff = new Date(now.getTime() - REPEAT_WINDOW_MS);
  try {
    const previous = await MovieViewer.findOneAndUpdate(
      {
        movieId,
        viewerKey,
        $or: [{ [fields.lastAt]: null }, { [fields.lastAt]: { $lt: cutoff } }],
      },
      {
        $inc: { [fields.count]: 1 },
        $set: { [fields.lastAt]: now, userId, deviceId, viewerType, platform },
      },
      { upsert: true, returnDocument: "before", setDefaultsOnInsert: true, lean: true }
    );
    return { isFirst: !previous?.[fields.count] };
  } catch (err) {
    // The row exists but is inside the window, so the upsert tried to insert
    if (err.code === DUPLICATE_KEY) return null;
    throw err;
  }
};

const addDailyActivity = async (movieId, viewer, fields, platform, now) => {
  const filter = { movieId, viewerKey: viewer.viewerKey, day: startOfDay(now), platform };
  const update = {
    $inc: { [fields.count]: 1 },
    $set: { [fields.lastAt]: now, userId: viewer.userId, viewerType: viewer.viewerType },
  };
  const options = { upsert: true, setDefaultsOnInsert: true };
  try {
    await MovieActivity.updateOne(filter, update, options);
  } catch (err) {
    // Two first events of the day at once: the row exists now
    if (err.code !== DUPLICATE_KEY) throw err;
    await MovieActivity.updateOne(filter, update, options);
  }
};

const notCounted = (movie, reason) => ({
  counted: false,
  reason,
  stats: toPublicStats(movie.stats),
});

/**
 * Records a view (movie page opened) or a play (video started). Admin /
 * staff, a locked movie's play and the same viewer again inside the repeat
 * window are answered with counted: false and the reason.
 */
exports.trackMovieEvent = async (movieId, { event, platform = null, deviceId }, user) => {
  validateObjectId(movieId, "Movie Id");
  const movie = await Movie.findOne({ _id: movieId, isDeleted: false })
    .select("accessType allowedPlans stats")
    .lean();
  if (!movie) throwError(404, "Movie not found");

  if (user && PRIVILEGED_ROLES.includes(user.role)) {
    return notCounted(movie, MOVIE_TRACK_SKIP_REASONS.STAFF);
  }
  if (!user && !deviceId) throwError(422, "deviceId is required for guests");
  if (event === MOVIE_EVENTS.PLAY && movie.accessType === MOVIE_ACCESS_TYPES.PAID) {
    const { isLocked } = await applyMovieAccess(movie, user);
    if (isLocked) return notCounted(movie, MOVIE_TRACK_SKIP_REASONS.MOVIE_LOCKED);
  }

  const now = new Date();
  const fields = EVENT_FIELDS[event];
  const viewer = await viewerOf(user, deviceId);
  const counted = await countForViewer(movie._id, viewer, fields, platform, now);
  if (!counted) return notCounted(movie, MOVIE_TRACK_SKIP_REASONS.REPEAT);

  await addDailyActivity(movie._id, viewer, fields, platform, now);
  const updated = await Movie.findByIdAndUpdate(
    movie._id,
    {
      $inc: {
        [`stats.${fields.count}`]: 1,
        [`stats.${fields.unique}`]: counted.isFirst ? 1 : 0,
      },
      $set: { [`stats.${fields.lastAt}`]: now },
    },
    { returnDocument: "after", lean: true }
  ).select("stats");
  return { counted: true, reason: null, stats: toPublicStats(updated?.stats) };
};
