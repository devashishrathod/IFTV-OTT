const { sendLoginOtpMail } = require("./sendLoginOtpMail");
const {
  sendOtpVerificationSuccessMail,
} = require("./sendOtpVerificationSuccessMail");
const {
  sendSupportTicketCreatedMail,
} = require("./sendSupportTicketCreatedMail");
const { sendSupportAdminAlertMail } = require("./sendSupportAdminAlertMail");
const { sendSupportReplyMail } = require("./sendSupportReplyMail");
const { sendPaymentSuccessMail } = require("./sendPaymentSuccessMail");
const {
  sendSubscriptionReminderMail,
} = require("./sendSubscriptionReminderMail");

module.exports = {
  sendLoginOtpMail,
  sendOtpVerificationSuccessMail,
  sendSupportTicketCreatedMail,
  sendSupportAdminAlertMail,
  sendSupportReplyMail,
  sendPaymentSuccessMail,
  sendSubscriptionReminderMail,
};
