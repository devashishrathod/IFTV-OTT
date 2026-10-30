const UNKNOWN = "unknown";

// Labels that title-casing gets wrong
const LABELS = Object.freeze({
  ios: "iOS",
  upi: "UPI",
  emi: "EMI",
  cardless_emi: "Cardless EMI",
  netbanking: "Net Banking",
  paylater: "Pay Later",
  contact_us: "Contact Us",
});

// in_progress → In Progress
const toLabel = (key) =>
  LABELS[key] ||
  String(key)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const round1 = (n) => Math.round(n * 10) / 10;

const percentOf = (part, total) => (total ? round1((part / total) * 100) : 0);

/**
 * KPI card: { value, previous, changePercent }. previous is null when there
 * is no compared period; changePercent is null when previous is 0.
 */
exports.toKpi = (value, previous) => ({
  value,
  previous: previous ?? null,
  changePercent:
    previous === null || previous === undefined || previous === 0
      ? null
      : round1(((value - previous) / previous) * 100),
});

/**
 * Pie / donut data from grouped rows ({ _id, count, amount? }).
 * - keys: fixed enum values, always present (zeros included) in that order.
 *   Rows outside the keys (missing field) are added as "unknown".
 * - without keys: one item per row, biggest first.
 * - by: "count" or "amount" (revenue circles); percent is taken on it.
 *   Items get an amount (paise) whenever the rows have one.
 * - labelOf(row): label for dynamic keys such as plan names.
 */
exports.toCircle = (rows = [], { keys, by = "count", labelOf } = {}) => {
  // Rows that carry an amount (payment circles) show it even when counted
  const withAmount = by === "amount" || rows.some((r) => r.amount !== undefined);
  const toItem = (key, row, label) => ({
    key,
    label: label || toLabel(key),
    count: row?.count || 0,
    ...(withAmount ? { amount: row?.amount || 0 } : {}),
  });

  let items;
  if (keys) {
    items = keys.map((key) => toItem(key, rows.find((r) => r._id === key)));
    const others = rows.filter((r) => !keys.includes(r._id));
    if (others.length) {
      items.push(
        toItem(UNKNOWN, {
          count: others.reduce((sum, r) => sum + r.count, 0),
          amount: others.reduce((sum, r) => sum + (r.amount || 0), 0),
        })
      );
    }
  } else {
    items = rows
      .map((row) => {
        const key = row._id === null || row._id === undefined ? UNKNOWN : String(row._id);
        return toItem(key, row, labelOf?.(row));
      })
      // Ties: bigger amount first, then by key, so the order never jumps
      .sort(
        (a, b) =>
          b[by] - a[by] || (b.amount || 0) - (a.amount || 0) || a.key.localeCompare(b.key)
      );
  }

  const total = items.reduce((sum, item) => sum + item[by], 0);
  return {
    total,
    items: items.map((item) => ({ ...item, percent: percentOf(item[by], total) })),
  };
};

// { open: 3, in_progress: 0, ... } with every key present
exports.toCounts = (keys, rows = []) =>
  Object.fromEntries(keys.map((key) => [key, rows.find((r) => r._id === key)?.count || 0]));

// First row of a $facet branch, or the fallback
exports.first = (rows, fallback = {}) => rows?.[0] || fallback;

exports.sumBy = (rows, field) => rows.reduce((sum, row) => sum + (row[field] || 0), 0);

exports.round1 = round1;
exports.percentOf = percentOf;
exports.UNKNOWN = UNKNOWN;
