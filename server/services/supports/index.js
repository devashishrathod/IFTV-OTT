const { createContactUs } = require("./createContactUs");
const { createTicket } = require("./createTicket");
const { getMyTickets } = require("./getMyTickets");
const { getMyTicket } = require("./getMyTicket");
const { replyToMyTicket } = require("./replyToMyTicket");
const { closeMyTicket } = require("./closeMyTicket");
const { adminGetAllTickets } = require("./adminGetAllTickets");
const { adminGetTicket } = require("./adminGetTicket");
const { adminReplyToTicket } = require("./adminReplyToTicket");
const { adminUpdateTicket } = require("./adminUpdateTicket");
const { adminDeleteTicket } = require("./adminDeleteTicket");
const { adminTicketStats } = require("./adminTicketStats");

module.exports = {
  createContactUs,
  createTicket,
  getMyTickets,
  getMyTicket,
  replyToMyTicket,
  closeMyTicket,
  adminGetAllTickets,
  adminGetTicket,
  adminReplyToTicket,
  adminUpdateTicket,
  adminDeleteTicket,
  adminTicketStats,
};
