const crypto = require("crypto");

/**
 * Human readable ticket number: SUP-YYMMDD-XXXX (date in IST + 4 random
 * digits), e.g. SUP-261010-4821. Not guaranteed unique on its own; the
 * unique index on ticketId catches a clash and the caller retries.
 */
exports.generateTicketId = () => {
  const date = new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) // 2026-10-10
    .slice(2)
    .replace(/-/g, "");
  const random = crypto.randomInt(1000, 10000);
  return `SUP-${date}-${random}`;
};
