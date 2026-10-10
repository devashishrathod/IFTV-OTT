const mongoose = require("mongoose");
const SupportTicket = require("../../models/SupportTicket");
const { SUPPORT_SOURCES } = require("../../constants");
const { pagination } = require("../../utils");

exports.getMyTickets = async (userId, query) => {
  let { page, limit, status } = query;
  page = page ? Number(page) : 1;
  limit = limit ? Number(limit) : 10;
  const match = {
    user: new mongoose.Types.ObjectId(userId),
    source: SUPPORT_SOURCES.TICKET,
    isDeleted: false,
  };
  if (status) match.status = status;
  const pipeline = [
    { $match: match },
    {
      $project: {
        ticketId: 1,
        category: 1,
        subject: 1,
        status: 1,
        platform: 1,
        attachments: 1,
        replyCount: { $size: "$replies" },
        lastReplyAt: 1,
        resolvedAt: 1,
        closedAt: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
    { $sort: { createdAt: -1, _id: -1 } },
  ];
  return await pagination(SupportTicket, pipeline, page, limit);
};
