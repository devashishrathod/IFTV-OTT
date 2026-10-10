const mongoose = require("mongoose");
const validator = require("validator");
const {
  ROLES,
  PLATFORMS,
  SUPPORT_SOURCES,
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  SUPPORT_PRIORITIES,
  SUPPORT_LIMITS,
} = require("../constants");
const { userField } = require("./validObjectId");

const isContactUs = function () {
  return this.source === SUPPORT_SOURCES.CONTACT_US;
};

const replySchema = new mongoose.Schema(
  {
    // null for replies that came from a guest (Contact Us)
    sender: { ...userField, default: null },
    senderRole: {
      type: String,
      enum: [...Object.values(ROLES)],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: SUPPORT_LIMITS.MAX_MESSAGE_LENGTH,
    },
    attachments: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true },
    source: {
      type: String,
      enum: [...Object.values(SUPPORT_SOURCES)],
      required: true,
    },
    user: { ...userField, default: null },
    // Contact details at the time of submission (guests have no user)
    name: { type: String, trim: true, required: isContactUs },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      required: isContactUs,
      validate: {
        validator: (v) => !v || validator.isEmail(v),
        message: (props) => `${props.value} is not a valid email address`,
      },
    },
    mobile: { type: String, trim: true },
    category: {
      type: String,
      enum: [...Object.values(SUPPORT_CATEGORIES)],
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: SUPPORT_LIMITS.MAX_SUBJECT_LENGTH,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: SUPPORT_LIMITS.MAX_MESSAGE_LENGTH,
    },
    attachments: { type: [String], default: [] },
    platform: {
      type: String,
      enum: [...Object.values(PLATFORMS)],
      default: PLATFORMS.WEB,
    },
    appVersion: { type: String, trim: true },
    status: {
      type: String,
      enum: [...Object.values(SUPPORT_STATUSES)],
      default: SUPPORT_STATUSES.OPEN,
    },
    priority: {
      type: String,
      enum: [...Object.values(SUPPORT_PRIORITIES)],
      default: SUPPORT_PRIORITIES.MEDIUM,
    },
    replies: { type: [replySchema], default: [] },
    assignedTo: { ...userField, default: null },
    // Internal note, never sent to the user
    adminNote: { type: String, trim: true },
    lastReplyAt: { type: Date },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

supportTicketSchema.index({ user: 1, status: 1 });
supportTicketSchema.index({ status: 1, source: 1, createdAt: -1 });
supportTicketSchema.index({ email: 1, source: 1, createdAt: -1 });

module.exports = mongoose.model("SupportTicket", supportTicketSchema);
