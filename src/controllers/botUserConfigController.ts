import { Request, Response } from 'express';
import BotUserConfig from '../models/botUserConfig';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';
import { isProxy } from '../middlewares/authMiddleware';
import BotUser from '../models/botUser';
import Bot from '../models/bot';
import { setupBot } from '../bot/botSetup';
import { sendMediaMessage } from '../utils/sendMultiMedia';

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

  // 代理用户只看自己的；管理员可跨代理查看
  if (isProxy(req.user) && !req.user.isAdmin) {
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
      .populate('promotionLink', 'title link code')
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

// 发送消息给 BotUserConfig 关联的用户
const sendMessage = handleAsync(async (req: RequestCustom, res: Response) => {
  const { id } = req.params;
  const { message, parseMode, medias } = req.body;

  if (!message || !message.trim()) {
    res.status(400);
    throw new Error('消息内容不能为空');
  }

  const botUserConfig = await BotUserConfig.findById(id)
    .populate('bot')
    .populate('botUser')
    .exec();

  if (!botUserConfig) {
    res.status(404);
    throw new Error('Bot user config not found');
  }

  const bot = botUserConfig.bot as any;
  const botUser = botUserConfig.botUser as any;

  if (!bot || !bot.token) {
    res.status(404);
    throw new Error('机器人不存在或未配置token');
  }

  if (!botUser || !botUser.id) {
    res.status(404);
    throw new Error('用户不存在');
  }

  const telegramBot = setupBot(bot.token);

  try {
    // 有媒体文件
    if (medias && Array.isArray(medias) && medias.length > 0) {
      await sendMediaMessage(telegramBot.api, botUser.id, medias, {
        caption: message,
        parse_mode: parseMode || undefined,
      });
    } else {
      // 纯文本消息
      await telegramBot.api.sendMessage(botUser.id, message, {
        parse_mode: parseMode || undefined,
      });
    }

    res.json({
      success: true,
      message: '消息发送成功',
    });
  } catch (error: any) {
    res.status(500);
    throw new Error(error.message || '发送消息失败');
  }
});

export {
  getBotUserConfigs,
  getBotUserConfigById,
  addBotUserConfig,
  updateBotUserConfig,
  deleteBotUserConfig,
  deleteMultipleBotUserConfigs,
  sendMessage,
};

/**
 * POST /bot-user-configs/public/location
 * Mini App 更新当前用户位置（供所有用户使用，无需登录）
 */
export const updateLocationPublic = handleAsync(
  async (req: Request, res: Response) => {
    const { botId, botUserId, lng, lat } = req.body;

    if (!botId || !botUserId) {
      res.status(400);
      throw new Error('缺少 botId 或 botUserId');
    }

    const lngNum = parseFloat(lng);
    const latNum = parseFloat(lat);

    if (
      isNaN(lngNum) ||
      isNaN(latNum) ||
      lngNum < -180 ||
      lngNum > 180 ||
      latNum < -90 ||
      latNum > 90
    ) {
      res.status(400);
      throw new Error('经纬度格式不正确');
    }

    const config = await BotUserConfig.findOneAndUpdate(
      { bot: botId, botUser: botUserId },
      {
        $set: {
          location: {
            type: 'Point',
            coordinates: [lngNum, latNum],
          },
        },
      },
      { new: true },
    );

    if (!config) {
      res.status(404);
      throw new Error('用户配置不存在');
    }

    res.json({ success: true, message: '位置已更新' });
  },
);
