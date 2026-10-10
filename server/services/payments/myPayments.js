const mongoose = require("mongoose");
const Payment = require("../../models/Payment");
const UserSubscription = require("../../models/UserSubscription");
const { pagination } = require("../../utils");
const { toUserPaymentView, findUserPayment } = require("./paymentHelpers");
const { toUserSubscriptionView } = require("../subscriptions/periods");

exports.getMyPayments = async (userId, query) => {
  let { page, limit, status } = query;
  page = page ? Number(page) : 1;
  limit = limit ? Number(limit) : 10;
  const match = { userId: new mongoose.Types.ObjectId(userId) };
  if (status) match.status = status;
  const pipeline = [
    { $match: match },
    {
      $project: {
        razorpaySignature: 0,
        upgradeFromSubscriptionId: 0,
        provider: 0,
      },
    },
    { $sort: { createdAt: -1, _id: -1 } },
  ];
  return await pagination(Payment, pipeline, page, limit, { allowEmpty: true });
};

// One payment as a receipt, with the subscription period it bought.
exports.getMyPayment = async (userId, id) => {
  const payment = await findUserPayment(userId, id);
  const subscription = payment.userSubscriptionId
    ? await UserSubscription.findById(payment.userSubscriptionId)
    : null;
  return {
    ...toUserPaymentView(payment),
    subscription: subscription ? toUserSubscriptionView(subscription) : null,
  };
};
