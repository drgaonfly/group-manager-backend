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

  if (queryParams.isActive !== undefined) {
    query.isActive = queryParams.isActive;
  }
  if (queryParams.message) {
    query.message = { $regex: queryParams.message, $options: 'i' };
  }
  if (queryParams.remarks) {
    query.remarks = { $regex: queryParams.remarks, $options: 'i' };
  }
  if (queryParams.url) {
    query.url = { $regex: queryParams.url, $options: 'i' };
  }

  if (queryParams.isActive !== undefined) {
    query.isActive = queryParams.isActive;
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
    } else {
      return null;
    }
  }

  return query;
};

const getBots = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query);

  if (query === null) {
    res.json({
      success: true,
      data: [],
      total: 0,
      current: +current,
      pageSize: +pageSize,
    });
    return;
  }

  const telegrams = await Bot.find(query)
    .populate('user')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Bot.countDocuments(query).exec();

  res.json({
    success: true,
    data: telegrams,
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

  const botManager = await Bot.create(req.body);

  await bot.api.setWebhook(`${WEBHOOK_URL}/bot-webhooks/${botManager._id}`);

  console.log(
    `${botManager.userName} Webhook ${botManager.token} 已设置为 ${WEBHOOK_URL}/webhook-${botManager.token}`,
  );

  res.status(201).json({
    success: true,
    data: bot,
  });
});

const getBotById = handleAsync(async (req: Request, res: Response) => {
  const telegram = await Bot.findById(req.params.id);

  if (!telegram) {
    res.status(404);
    throw new Error('Bot机器人不存在');
  }

  res.json({
    success: true,
    data: telegram,
  });
});

const updateBot = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { token } = req.body;

  const telegram = await Bot.findById(id);
  if (!telegram) {
    res.status(404);
    throw new Error('Bot机器人不存在');
  }

  if (token && token !== telegram.token) {
    const tokenExists = await Bot.findOne({ token, _id: { $ne: id } });
    if (tokenExists) {
      res.status(400);
      throw new Error('该Bot Token已被其他机器人使用');
    }
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

  const telegram = await Bot.findByIdAndDelete(id);

  if (!telegram) {
    res.status(404);
    throw new Error('Bot机器人不存在');
  }

  res.json({
    success: true,
    data: { message: 'Bot机器人删除成功' },
  });
});

const deleteMultipleBots = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body;

  await Bot.deleteMany({
    _id: { $in: ids },
  });

  res.json({
    success: true,
    message: `成功删除 ${ids.length} 个Bot机器人`,
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
