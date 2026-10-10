const { startSubscriptionJobs } = require("./subscriptionJobs");

// DISABLE_CRON=true turns background jobs off (e.g. on extra server copies).
exports.startJobs = () => {
  if (process.env.DISABLE_CRON === "true") return;
  startSubscriptionJobs();
};
