const SupportTicket = require("../../models/SupportTicket");
const { SUPPORT_SOURCES, SUPPORT_STATUSES } = require("../../constants");
const { generateTicketId } = require("../../helpers/supports");
const { throwError, validateObjectId } = require("../../utils");

const MAX_TICKET_ID_ATTEMPTS = 5;

/**
 * Creates a ticket with a fresh ticketId, retrying when the random part
 * clashes with an existing ticket (unique index).
 */
exports.createWithTicketId = async (data) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await SupportTicket.create({
        ...data,
        ticketId: generateTicketId(),
      });
    } catch (err) {
      const isTicketIdClash = err?.code === 11000 && err?.keyPattern?.ticketId;
      if (!isTicketIdClash || attempt >= MAX_TICKET_ID_ATTEMPTS) throw err;
    }
  }
};

/**
 * Sets the status and its timestamps. Returns true when the status changed.
 */
exports.applyStatus = (ticket, status) => {
  if (!status || ticket.status === status) return false;
  ticket.status = status;
  if (status === SUPPORT_STATUSES.RESOLVED) ticket.resolvedAt = new Date();
  if (status === SUPPORT_STATUSES.CLOSED) ticket.closedAt = new Date();
  if (
    status === SUPPORT_STATUSES.OPEN ||
    status === SUPPORT_STATUSES.IN_PROGRESS
  ) {
    ticket.resolvedAt = undefined;
    ticket.closedAt = undefined;
  }
  return true;
};

// What a user may see of their own ticket: no internal fields.
exports.toUserView = (ticket) => {
  const { adminNote, assignedTo, isDeleted, ...view } = ticket.toObject
    ? ticket.toObject()
    : ticket;
  return view;
};

exports.findUserTicket = async (userId, id) => {
  validateObjectId(id, "Ticket Id");
  const ticket = await SupportTicket.findOne({
    _id: id,
    user: userId,
    source: SUPPORT_SOURCES.TICKET,
    isDeleted: false,
  });
  if (!ticket) throwError(404, "Ticket not found");
  return ticket;
};

exports.findTicket = async (id) => {
  validateObjectId(id, "Ticket Id");
  const ticket = await SupportTicket.findOne({ _id: id, isDeleted: false });
  if (!ticket) throwError(404, "Ticket not found");
  return ticket;
};

exports.escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.buildDateRange = (fromDate, toDate) => {
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
