const mongoose = require("mongoose");
const SupportTicket = require("../../models/SupportTicket");
const { pagination } = require("../../utils");
const { escapeRegex, buildDateRange } = require("./ticketHelpers");

exports.adminGetAllTickets = async (query) => {
  let {
    page,
    limit,
    source,
    status,
    category,
    priority,
    platform,
    assignedTo,
    search,
    fromDate,
    toDate,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;
  page = page ? Number(page) : 1;
  limit = limit ? Number(limit) : 10;
  const match = { isDeleted: false };
  if (source) match.source = source;
  if (status) match.status = status;
  if (category) match.category = category;
  if (priority) match.priority = priority;
  if (platform) match.platform = platform;
  if (assignedTo) match.assignedTo = new mongoose.Types.ObjectId(assignedTo);
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    match.$or = [
      { ticketId: regex },
      { name: regex },
      { email: regex },
      { subject: regex },
    ];
  }
  const createdAt = buildDateRange(fromDate, toDate);
  if (createdAt) match.createdAt = createdAt;
  const direction = sortOrder === "asc" ? 1 : -1;
  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: "users",
        localField: "assignedTo",
        foreignField: "_id",
        as: "assignedAgent",
      },
    },
    {
      $project: {
        ticketId: 1,
        source: 1,
        user: 1,
        name: 1,
        email: 1,
        mobile: 1,
        category: 1,
        subject: 1,
        status: 1,
        priority: 1,
        platform: 1,
        assignedTo: {
          $cond: [
            { $gt: [{ $size: "$assignedAgent" }, 0] },
            {
              _id: { $arrayElemAt: ["$assignedAgent._id", 0] },
              name: { $arrayElemAt: ["$assignedAgent.name", 0] },
              email: { $arrayElemAt: ["$assignedAgent.email", 0] },
            },
            null,
          ],
        },
        replyCount: { $size: "$replies" },
        attachmentCount: { $size: "$attachments" },
        lastReplyAt: 1,
        resolvedAt: 1,
        closedAt: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
    { $sort: { [sortBy]: direction, _id: direction } },
  ];
  return await pagination(SupportTicket, pipeline, page, limit);
};
