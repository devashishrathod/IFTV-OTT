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

module.exports = {
  sendLoginOtpMail,
  sendOtpVerificationSuccessMail,
  sendSupportTicketCreatedMail,
  sendSupportAdminAlertMail,
  sendSupportReplyMail,
  sendPaymentSuccessMail,
};
