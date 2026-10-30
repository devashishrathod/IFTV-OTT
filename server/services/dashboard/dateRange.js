const {
  DASHBOARD_RANGES,
  DASHBOARD_GROUP_BY,
  DASHBOARD_LIMITS,
} = require("../../constants");
const { throwError } = require("../../utils");

const { TIMEZONE } = DASHBOARD_LIMITS;
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// IST calendar parts of a moment
const istParts = (date) => {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth(),
    day: ist.getUTCDate(),
    weekday: ist.getUTCDay(),
  };
};

// IST midnight of a calendar day. Overflowing month / day values roll over.
const istMidnight = (year, month, day) =>
  new Date(Date.UTC(year, month, day) - IST_OFFSET_MS);

const startOfDay = (date) => {
  const { year, month, day } = istParts(date);
  return istMidnight(year, month, day);
};

const startOfMonth = (date, offset = 0) => {
  const { year, month } = istParts(date);
  return istMidnight(year, month + offset, 1);
};

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

// 2026-10-01 for the IST calendar day of a moment
const toDayString = (date) =>
  new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

const fromDayString = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  return istMidnight(year, month - 1, day);
};

/**
 * Start (inclusive) and end (exclusive) of a preset. all_time starts at the
 * first record, passed in as `firstRecordAt`.
 */
const presetRange = (range, { fromDate, toDate }, now, firstRecordAt) => {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  switch (range) {
    case DASHBOARD_RANGES.TODAY:
      return { start: today, end: tomorrow };
    case DASHBOARD_RANGES.YESTERDAY:
      return { start: addDays(today, -1), end: today };
    case DASHBOARD_RANGES.LAST_7_DAYS:
      return { start: addDays(today, -6), end: tomorrow };
    case DASHBOARD_RANGES.LAST_30_DAYS:
      return { start: addDays(today, -29), end: tomorrow };
    case DASHBOARD_RANGES.LAST_90_DAYS:
      return { start: addDays(today, -89), end: tomorrow };
    case DASHBOARD_RANGES.THIS_MONTH:
      return { start: startOfMonth(now), end: tomorrow };
    case DASHBOARD_RANGES.LAST_MONTH:
      return { start: startOfMonth(now, -1), end: startOfMonth(now) };
    case DASHBOARD_RANGES.THIS_YEAR:
      return { start: istMidnight(istParts(now).year, 0, 1), end: tomorrow };
    case DASHBOARD_RANGES.ALL_TIME:
      return {
        start: firstRecordAt ? startOfDay(firstRecordAt) : today,
        end: tomorrow,
      };
    default:
      return {
        start: fromDayString(fromDate),
        end: toDate ? addDays(fromDayString(toDate), 1) : tomorrow,
      };
  }
};

/**
 * The period compared against: the same length right before, except month
 * and year presets, which compare with the same days of the month / year
 * before.
 */
const previousRange = (range, { start, end }) => {
  const length = end - start;
  if (range === DASHBOARD_RANGES.LAST_MONTH) {
    return { start: startOfMonth(start, -1), end: start };
  }
  if (range === DASHBOARD_RANGES.THIS_MONTH || range === DASHBOARD_RANGES.THIS_YEAR) {
    const { year, month } = istParts(start);
    const prevStart =
      range === DASHBOARD_RANGES.THIS_MONTH
        ? istMidnight(year, month - 1, 1)
        : istMidnight(year - 1, 0, 1);
    return {
      start: prevStart,
      end: new Date(Math.min(prevStart.getTime() + length, start.getTime())),
    };
  }
  return { start: new Date(start.getTime() - length), end: start };
};

const autoGroupBy = (days) => {
  if (days <= DASHBOARD_LIMITS.AUTO_DAY_MAX_DAYS) return DASHBOARD_GROUP_BY.DAY;
  if (days <= DASHBOARD_LIMITS.AUTO_WEEK_MAX_DAYS) return DASHBOARD_GROUP_BY.WEEK;
  return DASHBOARD_GROUP_BY.MONTH;
};

// First bucket start on or before `start`: the day, its Monday or the 1st
const bucketStart = (start, groupBy) => {
  if (groupBy === DASHBOARD_GROUP_BY.MONTH) return startOfMonth(start);
  if (groupBy === DASHBOARD_GROUP_BY.WEEK) {
    return addDays(startOfDay(start), -((istParts(start).weekday + 6) % 7));
  }
  return startOfDay(start);
};

const nextBucket = (date, groupBy) => {
  if (groupBy === DASHBOARD_GROUP_BY.MONTH) return startOfMonth(date, 1);
  return addDays(date, groupBy === DASHBOARD_GROUP_BY.WEEK ? 7 : 1);
};

const bucketLabel = (date, groupBy) => {
  const { year, month, day } = istParts(date);
  if (groupBy === DASHBOARD_GROUP_BY.MONTH) return `${MONTHS[month]} ${year}`;
  return `${day} ${MONTHS[month]}`;
};

/**
 * Every chart bucket of the range, oldest first: [{ date, label }].
 */
exports.buildBuckets = ({ start, end }, groupBy) => {
  const buckets = [];
  for (let at = bucketStart(start, groupBy); at < end; at = nextBucket(at, groupBy)) {
    buckets.push({ date: toDayString(at), label: bucketLabel(at, groupBy) });
  }
  return buckets;
};

/**
 * Mongo expression giving the bucket key (YYYY-MM-DD, IST) of a date field.
 * Matches the `date` of buildBuckets.
 */
exports.bucketKey = (field, groupBy) => {
  const trunc = { date: field, unit: groupBy, timezone: TIMEZONE };
  if (groupBy === DASHBOARD_GROUP_BY.WEEK) trunc.startOfWeek = "monday";
  return {
    $dateToString: { format: "%Y-%m-%d", timezone: TIMEZONE, date: { $dateTrunc: trunc } },
  };
};

// { $gte, $lt } match on a date field
exports.inRange = ({ start, end }) => ({ $gte: start, $lt: end });

/**
 * Turns the validated query into the current period, the compared period
 * and the chart grouping.
 */
exports.resolvePeriod = (query, now = new Date(), firstRecordAt = null) => {
  const current = presetRange(query.range, query, now, firstRecordAt);
  const days = Math.round((current.end - current.start) / DAY_MS);
  const groupBy = query.groupBy || autoGroupBy(days);
  if (groupBy === DASHBOARD_GROUP_BY.DAY && days > DASHBOARD_LIMITS.MAX_DAY_BUCKETS) {
    throwError(
      422,
      `groupBy=day allows at most ${DASHBOARD_LIMITS.MAX_DAY_BUCKETS} days, use week or month`
    );
  }
  const compare =
    query.compare !== false && query.range !== DASHBOARD_RANGES.ALL_TIME;
  return {
    current,
    previous: compare ? previousRange(query.range, current) : null,
    groupBy,
    days,
  };
};

exports.toDayString = toDayString;
exports.startOfDay = startOfDay;
exports.startOfMonth = startOfMonth;
exports.addDays = addDays;
exports.DAY_MS = DAY_MS;
