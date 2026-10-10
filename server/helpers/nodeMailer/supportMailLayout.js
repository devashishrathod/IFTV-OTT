const nodemailer = require("nodemailer");

// User-written text goes into the mail HTML, so it must be escaped.
const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const multiline = (value) => escapeHtml(value).replace(/\n/g, "<br>");

const layout = (heading, body) => `
  <div style="max-width: 600px; margin: auto; padding: 30px; font-family: Arial, sans-serif; background-color: #f9f9f9; border-radius: 10px; border: 1px solid #e0e0e0;">
    <h2 style="text-align: center; color: #4CAF50;">${heading}</h2>
    ${body}
    <hr style="margin: 30px 0;">
    <p style="font-size: 12px; color: #aaa; text-align: center;">
      © ${new Date().getFullYear()} IFTV-OTT. All rights reserved.
    </p>
  </div>
`;

/**
 * Sends a support mail without blocking the request. A failed mail is only
 * logged: the ticket is already saved and must not fail because of it.
 */
const sendSupportMail = ({ to, subject, heading, body }) => {
  if (!to) return;
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.NODEMAILER_EMAIL,
      pass: process.env.NODEMAILER_PASSWORD,
    },
    tls: { rejectUnauthorized: false },
  });
  transporter
    .sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to,
      subject,
      html: layout(heading, body),
    })
    .catch((error) => console.error("Error sending support email:", error));
};

module.exports = { escapeHtml, multiline, sendSupportMail };
