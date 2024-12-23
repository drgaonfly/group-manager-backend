import { Request, Response } from 'express';
import Bot from '../models/bot';
import handleAsync from '../utils/handleAsync';
import User from '../models/user';
import { setupBot } from '../bot/botSetup';

const buildQuery = async (queryParams: any): Promise<any> => {
  const query: any = {};

  if (queryParams.token) {
    query.token = queryParams.token;
  }

  if (queryParams.botName) {
    query.botName = { $regex: queryParams.botName, $options: 'i' };
  }

  if (queryParams.message) {
    query.message = { $regex: queryParams.message, $options: 'i' };
  }

  if (queryParams.remark) {
    query.remark = { $regex: queryParams.remark, $options: 'i' };
  }

  if (queryParams.isOnline !== undefined) {
    query.isOnline = queryParams.isOnline;
  }

  if (queryParams.user) {
    let searchText;
    try {
      const userParam = JSON.parse(String(queryParams.user));
      searchText = userParam.name;
    } catch (e) {
      searchText = String(queryParams.user).trim();
    }
    const userData = await User.find({
      name: {
        $regex: searchText,
        $options: 'i',
      },
    });

    if (userData && userData.length > 0) {
      query.user = { $in: userData.map((user) => user._id) };
    }
  }

  return query;
};

const getBots = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query);

  const bots = await Bot.find(query)
    .populate('user')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Bot.countDocuments(query).exec();

  res.json({
    success: true,
    data: bots,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

const addBot = handleAsync(async (req: Request, res: Response) => {
  const { token } = req.body;

  const botExists = await Bot.findOne({ token });

  if (botExists) {
    res.status(400);
    throw new Error('该 Bot Token 已被使用，请使用其他 Token');
  }

  const bot = setupBot(token);

  const WEBHOOK_URL = process.env.WEBHOOK_URL;

  console.log('Bot 正在运行于生产模式');

  const botManager = new Bot(req.body);

  await bot.api.setWebhook(`${WEBHOOK_URL}/bot-webhooks/${botManager._id}`);

  await botManager.save();

  const info = await bot.api.getWebhookInfo();
  console.log(`${botManager.userName} webhook info`);
  console.log(info);
  console.log(
    `${botManager.userName} Webhook ${botManager.token} 已设置为 ${WEBHOOK_URL}/webhook-${botManager.token}`,
  );

  res.status(201).json({
    success: true,
    data: botManager,
  });
});

const getBotById = handleAsync(async (req: Request, res: Response) => {
  const bot = await Bot.findById(req.params.id);

  if (!bot) {
    res.status(404);
    throw new Error('Bot 机器人不存在');
  }

  res.json({
    success: true,
    data: bot,
  });
});

const updateBot = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const bot = await Bot.findById(id);

  if (!bot) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  const updatedBot = await Bot.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  res.json({
    success: true,
    data: updatedBot,
  });
});

const deleteBot = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const bot = await Bot.findByIdAndDelete(id);

  if (!bot) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  res.json({
    success: true,
    data: { message: '机器人删除成功' },
  });
});

const deleteMultipleBots = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body;

  const bots = await Bot.find({ _id: { $in: ids } });

  if (bots.length === 0) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  for (const botManager of bots) {
    const bot = setupBot(botManager.token);
    const info = await bot.api.getWebhookInfo();
    console.log(`${botManager.userName} webhook info`);
    console.log(info);
    await bot.api.deleteWebhook();
    console.log(`${botManager.userName} Webhook ${botManager.token} 已删除`);
  }

  const botIds = bots.map((bot) => bot._id);

  await Bot.deleteMany({
    _id: { $in: botIds },
  });

  res.json({
    success: true,
    message: `成功删除 ${ids.length} 个机器人`,
  });
});

export {
  getBots,
  addBot,
  getBotById,
  updateBot,
  deleteBot,
  deleteMultipleBots,
};
