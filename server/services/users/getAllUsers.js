const User = require("../../models/User");
const UserSubscription = require("../../models/UserSubscription");
const { ROLES } = require("../../constants");
const { pagination } = require("../../utils");
const {
  ENTITLED_STATUSES,
  splitPeriods,
  toAdminSubscriptionView,
} = require("../subscriptions/periods");

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildDateRange = (fromDate, toDate) => {
  if (!fromDate && !toDate) return undefined;
  const range = {};
  if (fromDate) range.$gte = new Date(fromDate);
  if (toDate) {
    const d = new Date(toDate);
    d.setHours(23, 59, 59, 999);
    range.$lte = d;
  }
  return range;
};

// mobile is stored as a Number, so partial matches run on its text form
const mobileMatches = (digits) => ({
  $expr: {
    $regexMatch: {
      input: { $ifNull: [{ $toString: "$mobile" }, ""] },
      regex: escapeRegex(digits),
    },
  },
});

// password, otp, fcmToken, isDeleted and locations never leave the server
const USER_LIST_FIELDS = {
  name: 1,
  email: 1,
  mobile: 1,
  image: 1,
  role: 1,
  loginType: 1,
  dob: 1,
  address: 1,
  currentScreen: 1,
  isEmailVerified: 1,
  isMobileVerified: 1,
  isSignUpCompleted: 1,
  isOnBoardingCompleted: 1,
  isLoggedIn: 1,
  isOnline: 1,
  isActive: 1,
  lastActivity: 1,
  createdAt: 1,
  updatedAt: 1,
};

const BOOLEAN_FILTERS = [
  "isActive",
  "isEmailVerified",
  "isMobileVerified",
  "isSignUpCompleted",
  "isOnBoardingCompleted",
  "isLoggedIn",
  "isOnline",
];

// Same rule as access checks: dates decide, the stored status only narrows
const currentPeriodFilter = (now) => ({
  status: { $in: ENTITLED_STATUSES },
  startDate: { $lte: now },
  endDate: { $gt: now },
});

const toListSubscription = (period, now) => {
  const { _id, planId, plan, status, source, startDate, endDate, daysLeft, platform } =
    toAdminSubscriptionView(period, now);
  return { _id, planId, plan, status, source, startDate, endDate, daysLeft, platform };
};

/**
 * Current plan of each user on the page, in one query. Users without one get
 * isSubscribed: false and subscription: null.
 */
const attachSubscriptions = async (users, now) => {
  if (users.length === 0) return users;
  const periods = await UserSubscription.find({
    userId: { $in: users.map((u) => u._id) },
    status: { $in: ENTITLED_STATUSES },
    endDate: { $gt: now },
  })
    .sort({ startDate: 1, _id: 1 })
    .lean();
  const periodsByUser = new Map();
  for (const period of periods) {
    const key = String(period.userId);
    if (!periodsByUser.has(key)) periodsByUser.set(key, []);
    periodsByUser.get(key).push(period);
  }
  return users.map((user) => {
    const { current, scheduled } = splitPeriods(
      periodsByUser.get(String(user._id)) || [],
      now
    );
    return {
      ...user,
      isSubscribed: Boolean(current),
      subscription: current ? toListSubscription(current, now) : null,
      hasScheduled: scheduled.length > 0,
    };
  });
};

exports.getAllUsers = async (query) => {
  let {
    page,
    limit,
    role = ROLES.USER,
    search,
    name,
    email,
    mobile,
    loginType,
    currentScreen,
    isSubscribed,
    planId,
    fromDate,
    toDate,
    lastActivityFrom,
    lastActivityTo,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;
  page = page ? Number(page) : 1;
  limit = limit ? Number(limit) : 10;
  const now = new Date();
  const match = { isDeleted: false };
  if (role !== "all") match.role = role;
  if (loginType) match.loginType = loginType;
  if (currentScreen) match.currentScreen = currentScreen;
  for (const field of BOOLEAN_FILTERS) {
    if (typeof query[field] === "boolean") match[field] = query[field];
  }
  if (name) match.name = new RegExp(escapeRegex(name), "i");
  if (email) match.email = new RegExp(escapeRegex(email), "i");
  const and = [];
  if (mobile) and.push(mobileMatches(mobile));
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    and.push({
      $or: [
        { name: regex },
        { email: regex },
        // only digits can be part of a mobile number
        ...(/^\d+$/.test(search) ? [mobileMatches(search)] : []),
      ],
    });
  }
  if (and.length) match.$and = and;
  const createdAt = buildDateRange(fromDate, toDate);
  if (createdAt) match.createdAt = createdAt;
  const lastActivity = buildDateRange(lastActivityFrom, lastActivityTo);
  if (lastActivity) match.lastActivity = lastActivity;
  if (planId || typeof isSubscribed === "boolean") {
    const subscribedIds = await UserSubscription.distinct("userId", {
      ...currentPeriodFilter(now),
      ...(planId ? { planId } : {}),
    });
    match._id = isSubscribed === false ? { $nin: subscribedIds } : { $in: subscribedIds };
  }
  const direction = sortOrder === "asc" ? 1 : -1;
  const pipeline = [
    { $match: match },
    { $sort: { [sortBy]: direction, _id: direction } },
    { $project: USER_LIST_FIELDS },
  ];
  const result = await pagination(User, pipeline, page, limit, {
    allowEmpty: true,
  });
  result.data = await attachSubscriptions(result.data, now);
  return result;
};
