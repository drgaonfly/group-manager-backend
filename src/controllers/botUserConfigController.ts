import { Request, Response } from 'express';
import BotUserConfig from '../models/botUserConfig';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';
import { isProxy } from '../middlewares/authMiddleware';
import BotUser from '../models/botUser';
import Bot from '../models/bot';

// Build query based on query parameters
const buildQuery = async (queryParams: any, req: RequestCustom) => {
  const query: any = {};

  if (queryParams.bot) {
    // 先去 bot 里找出来吧，要用正则 i
    const botDocs = await Bot.find({
      $or: [
        { botName: { $regex: queryParams.bot, $options: 'i' } },
        { userName: { $regex: queryParams.bot, $options: 'i' } },
      ],
    }).select('_id');

    const botIds = botDocs.map((doc: any) => doc._id);
    query.bot = { $in: botIds };
  }

  if (queryParams.botUser) {
    // 先去 botUser 里找出来吧，要用正则 i
    const botUserDocs = await BotUser.find({
      $or: [
        { userName: { $regex: queryParams.botUser, $options: 'i' } },
        { firstName: { $regex: queryParams.botUser, $options: 'i' } },
        { lastName: { $regex: queryParams.botUser, $options: 'i' } },
        { id: { $regex: queryParams.botUser, $options: 'i' } },
      ],
    }).select('_id');

    const botUserIds = botUserDocs.map((doc: any) => doc._id);
    query.botUser = { $in: botUserIds };
  }

  if (isProxy(req.user)) {
    query.proxy = req.user._id;
  }

  return query;
};

// 获取所有用户配置
const getBotUserConfigs = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = await buildQuery(req.query, req);

    const botUserConfigs = await BotUserConfig.find(query)
      .populate('botUser')
      .populate('proxy')
      .populate('bot')
      .populate({
        path: 'parent',
        populate: { path: 'botUser' },
      })
      .populate('invited_group')
      .sort('-createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    const total = await BotUserConfig.countDocuments(query).exec();

    res.json({
      success: true,
      data: botUserConfigs,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

// 根据 ID 获取用户配置
const getBotUserConfigById = handleAsync(
  async (req: Request, res: Response) => {
    const botUserConfig = await BotUserConfig.findById(req.params.id).exec();

    if (!botUserConfig) {
      res.status(404);
      throw new Error('Bot user config not found');
    }

    res.json({
      success: true,
      data: botUserConfig,
    });
  },
);

// 添加新用户配置
const addBotUserConfig = handleAsync(async (req: Request, res: Response) => {
  const newBotUserConfig = new BotUserConfig({
    ...req.body,
  });

  const savedBotUserConfig = await newBotUserConfig.save();

  res.json({
    success: true,
    data: savedBotUserConfig,
  });
});

// 更新用户配置
const updateBotUserConfig = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedBotUserConfig = await BotUserConfig.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  ).exec();

  if (!updatedBotUserConfig) {
    res.status(404);
    throw new Error('Bot user config not found');
  }

  res.json({
    success: true,
    data: updatedBotUserConfig,
  });
});

// 删除用户配置
const deleteBotUserConfig = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const deletedBotUserConfig = await BotUserConfig.findByIdAndDelete(id).exec();

  if (!deletedBotUserConfig) {
    res.status(404);
    throw new Error('Bot user config not found');
  }

  res.json({
    success: true,
    data: { message: 'Bot user config deleted successfully' },
  });
});

// 批量删除用户配置
const deleteMultipleBotUserConfigs = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await BotUserConfig.deleteMany({
      _id: { $in: ids },
    }).exec();

    res.json({
      success: true,
      message: `${ids.length} bot user configs deleted successfully`,
    });
  },
);

export {
  getBotUserConfigs,
  getBotUserConfigById,
  addBotUserConfig,
  updateBotUserConfig,
  deleteBotUserConfig,
  deleteMultipleBotUserConfigs,
};
