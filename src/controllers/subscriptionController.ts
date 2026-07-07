import { Request, Response } from 'express';
import Subscription from '../models/subscription';
import BotUser from '../models/botUser';
import handleAsync from '../utils/handleAsync';

// 构建查询参数
const buildQuery = async (queryParams: any): Promise<any> => {
  const query: any = {};

  // status
  if (queryParams.status) {
    query.status = queryParams.status;
  }

  // botUser 搜索（支持按用户名模糊搜索）
  if (queryParams.botUser) {
    const botUsers = await BotUser.find({
      userName: { $regex: queryParams.botUser, $options: 'i' },
    });
    query.botUser =
      botUsers.length > 0 ? { $in: botUsers.map((u) => u._id) } : null;
  }

  return query;
};

// 获取所有订阅
const getSubscriptions = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query);

  const subscriptions = await Subscription.find(query)
    .populate('botUser')
    .populate('bot')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Subscription.countDocuments(query).exec();

  res.json({
    success: true,
    data: subscriptions,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 获取订阅详情
const getSubscriptionById = handleAsync(async (req: Request, res: Response) => {
  const subscription = await Subscription.findById(req.params.id)
    .populate('botUser')
    .populate('bot')
    .exec();

  if (!subscription) {
    res.status(404);
    throw new Error('Subscription not found');
  }

  res.json({
    success: true,
    data: subscription,
  });
});

// 创建新订阅订单（后台手动创建或用户发起）
// const addSubscription = handleAsync(async (req: Request, res: Response) => {
//   const { botId, botUserId, plan, timeoutMinutes = 30 } = req.body;

//   // 验证 bot 和 botUser 存在
//   const bot = await Bot.findById(botId).select('receiveAddress').lean();
//   if (!bot) {
//     res.status(404);
//     throw new Error('Bot not found');
//   }

//   if (!bot.receiveAddress) {
//     res.status(400);
//     throw new Error('Bot 未配置收款地址');
//   }

//   // 检查是否有未超时的 pending 订单
//   const existingPending = await Subscription.findOne({
//     bot: botId,
//     botUser: botUserId,
//     status: 'pending',
//     orderExpiredAt: { $gt: new Date() },
//   }).lean();

//   if (existingPending) {
//     res.json({
//       success: true,
//       data: existingPending,
//       message: '已有待支付订单，请勿重复创建',
//     });
//     return;
//   }

//   // 生成唯一金额（基础价格 + 随机尾数，避免金额冲突）
//   const tail = Math.floor(Math.random() * 99 + 1) / 100;
//   const uniqueAmount = Math.round((planConfig.price + tail) * 100) / 100;

//   const orderExpiredAt = new Date();
//   orderExpiredAt.setMinutes(orderExpiredAt.getMinutes() + Number(timeoutMinutes));

//   const newId = await IdGen.next(Subscription, 'id', 6);

//   const newSubscription = new Subscription({
//     id: newId,
//     botUser: botUserId,
//     bot: botId,
//     amount: uniqueAmount,
//     days: days,
//     toAddress: bot.receiveAddress,
//     orderExpiredAt,
//     status: 'pending',
//   });

//   const savedSubscription = await newSubscription.save();

//   res.status(201).json({
//     success: true,
//     data: savedSubscription,
//   });
// });

// 更新订阅（主要用于后台手动修改）
const updateSubscription = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedSubscription = await Subscription.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  )
    .populate('botUser')
    .populate('bot')
    .exec();

  if (!updatedSubscription) {
    res.status(404);
    throw new Error('Subscription not found');
  }

  res.json({
    success: true,
    data: updatedSubscription,
  });
});

// 删除订阅
const deleteSubscription = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const subscription = await Subscription.findByIdAndDelete(id).exec();

  if (!subscription) {
    res.status(404);
    throw new Error('Subscription not found');
  }

  res.json({
    success: true,
    data: { message: 'Subscription deleted successfully' },
  });
});

// 批量删除订阅
const deleteMultipleSubscriptions = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Subscription.deleteMany({
      _id: { $in: ids },
    }).exec();

    res.json({
      success: true,
      message: `${ids.length} subscriptions deleted successfully`,
    });
  },
);

export {
  getSubscriptions,
  getSubscriptionById,
  // addSubscription,
  updateSubscription,
  deleteSubscription,
  deleteMultipleSubscriptions,
};
