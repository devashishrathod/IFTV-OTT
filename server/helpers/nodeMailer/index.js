const { sendLoginOtpMail } = require("./sendLoginOtpMail");
const {
  sendOtpVerificationSuccessMail,
} = require("./sendOtpVerificationSuccessMail");
const {
  sendSupportTicketCreatedMail,
} = require("./sendSupportTicketCreatedMail");
const { sendSupportAdminAlertMail } = require("./sendSupportAdminAlertMail");
const { sendSupportReplyMail } = require("./sendSupportReplyMail");

module.exports = {
  sendLoginOtpMail,
  sendOtpVerificationSuccessMail,
  sendSupportTicketCreatedMail,
  sendSupportAdminAlertMail,
  sendSupportReplyMail,
};
