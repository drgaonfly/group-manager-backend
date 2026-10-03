import { Request, Response } from 'express';
import Bot from '../models/bot';
import User from '../models/user';
import BotUser from '../models/botUser';
import Group from '../models/group';
import handleAsync from '../utils/handleAsync';
import { generateToken, generateRefreshToken } from '../utils/generateToken';

/**
 * GET /api/public/bots/:botId/:botUserId
 *
 * 无需鉴权的公开接口。
 * 返回该 Telegram 用户在指定 bot 下，作为群主或管理员的群组/频道列表。
 */
export const getPublicBotGroupsForUser = handleAsync(
  async (req: Request, res: Response) => {
    const { botId, botUserId } = req.params;

    // 1. 获取 query 参数
    const {
      type, // 'channel' 或 'group'
      keyword, // 模糊搜索关键词
      page = 1,
      pageSize = 10,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, parseInt(pageSize as string, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    // 2. 查找 Bot
    const bot = await Bot.findById(botId)
      .select('_id botName userName isOnline type disabledAt')
      .lean();

    if (!bot) {
      res.status(404);
      throw new Error('Bot 不存在或非公共机器人');
    }

    // 3. 查找 BotUser
    const botUser = await BotUser.findById(botUserId);

    if (!botUser) {
      res.json({ success: true, data: null });
      return;
    }

    // 4. 查找代理用户
    const proxyUser = await User.findById(botUser.proxy);

    if (!proxyUser) {
      res.json({ success: true, data: null });
      return;
    }

    // 5. 构造可见性条件：用户是群主（creator）OR 是管理员（operators）
    const visibilityCond = [
      { creator: botUser._id },
      { operators: botUser._id },
    ];

    // 用 $and 数组承载所有条件，避免 $or 之间互相覆盖
    const queryCond: any = {
      isOnline: true,
      bot: bot._id,
      $and: [{ $or: visibilityCond }],
    };

    // 按类型过滤
    if (type === 'channel') {
      queryCond.type = 'channel';
    } else {
      queryCond.type = { $ne: 'channel' };
    }

    // 搜索关键词（支持 title 和 username），追加到 $and 避免覆盖
    if (keyword) {
      const regex = new RegExp(keyword as string, 'i');
      queryCond.$and.push({ $or: [{ title: regex }, { username: regex }] });
    }

    // 6. 并行查询列表 + 总数
    const [total, groups] = await Promise.all([
      Group.countDocuments(queryCond),
      Group.find(queryCond)
        .populate({ path: 'creator', select: 'id' })
        .populate({ path: 'operators', select: 'id' })
        .populate('memberCount')
        .select('_id title username type creator operators')
        .sort('+created')
        .skip(skip)
        .limit(limitNum),
    ]);

    // 7. 统计顶部卡片：群组数 / 频道数（与列表使用相同的可见性条件）
    const [groupCount, channelCount] = await Promise.all([
      Group.countDocuments({
        isOnline: true,
        bot: bot._id,
        $or: visibilityCond,
        type: { $ne: 'channel' },
      }),
      Group.countDocuments({
        isOnline: true,
        bot: bot._id,
        $or: visibilityCond,
        type: 'channel',
      }),
    ]);

    // 8. 生成 token 并返回数据
    const token = generateToken(proxyUser._id.toString());
    const refreshToken = generateRefreshToken(proxyUser._id.toString());

    res.json({
      success: true,
      data: {
        bot,
        botUser,
        proxyUser,
        groups,
        pagination: {
          total,
          page: pageNum,
          pageSize: limitNum,
        },
        stats: {
          groupCount,
          channelCount,
        },
      },
      token,
      refreshToken,
    });
  },
);
