const {
  ROLES,
  MOVIE_ACCESS_TYPES,
  MOVIE_LOCK_REASONS,
  PAYMENT_LIMITS,
} = require("../../constants");
const { toPaise, getActivePlans, getCurrentPeriod } = require("./periods");

const PRIVILEGED_ROLES = [ROLES.ADMIN, ROLES.STAFF];

const getViewer = async (user) => {
  if (!user) return { isLoggedIn: false };
  if (PRIVILEGED_ROLES.includes(user.role)) {
    return { isLoggedIn: true, isPrivileged: true };
  }
  const current = await getCurrentPeriod(user._id);
  return {
    isLoggedIn: true,
    activePlanId: current ? String(current.planId) : null,
  };
};

const toAvailablePlan = (plan) => ({
  _id: plan._id,
  name: plan.name,
  type: plan.type,
  price: plan.price,
  durationInDays: plan.durationInDays,
});

const lockReasonFor = (viewer, allowedPlanIds) => {
  if (viewer.isPrivileged) return null;
  if (!viewer.isLoggedIn) return MOVIE_LOCK_REASONS.LOGIN_REQUIRED;
  if (!viewer.activePlanId) return MOVIE_LOCK_REASONS.SUBSCRIPTION_REQUIRED;
  if (allowedPlanIds.length && !allowedPlanIds.includes(viewer.activePlanId)) {
    return MOVIE_LOCK_REASONS.PLAN_NOT_INCLUDED;
  }
  return null;
};

const toMovieView = (movie, viewer, activePlans) => {
  const view = movie?.toObject ? movie.toObject() : { ...movie };
  view.accessType = view.accessType || MOVIE_ACCESS_TYPES.FREE;
  view.allowedPlans = view.allowedPlans || [];
  if (view.accessType !== MOVIE_ACCESS_TYPES.PAID) {
    return { ...view, isLocked: false, lockReason: null, availableInPlans: [] };
  }
  const allowedPlanIds = view.allowedPlans.map(String);
  // Only plans a user could actually buy (₹0 plans are admin-grant only)
  const availableInPlans = activePlans
    .filter((p) => toPaise(p.price) >= PAYMENT_LIMITS.MIN_AMOUNT_PAISE)
    .filter((p) => !allowedPlanIds.length || allowedPlanIds.includes(String(p._id)))
    .map(toAvailablePlan);
  const lockReason = lockReasonFor(viewer, allowedPlanIds);
  return {
    ...view,
    // A locked movie never carries its video URL
    ...(lockReason ? { video: null } : {}),
    isLocked: Boolean(lockReason),
    lockReason,
    availableInPlans,
  };
};

/**
 * Adds isLocked / lockReason / availableInPlans to one movie or a list, for
 * the given viewer (req.user, or undefined for a guest). Free movies, and
 * every movie for admin / staff, stay unlocked.
 */
exports.applyMovieAccess = async (movies, user) => {
  const list = Array.isArray(movies) ? movies : [movies];
  const hasPaid = list.some((m) => m?.accessType === MOVIE_ACCESS_TYPES.PAID);
  const [viewer, activePlans] = await Promise.all([
    hasPaid ? getViewer(user) : { isLoggedIn: Boolean(user) },
    hasPaid ? getActivePlans() : [],
  ]);
  const views = list.map((m) => toMovieView(m, viewer, activePlans));
  return Array.isArray(movies) ? views : views[0];
};
