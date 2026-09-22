import { Request, Response } from 'express';
import Bot from '../models/bot';
import User from '../models/user';
import BotUser from '../models/botUser';
import Group from '../models/group';
import handleAsync from '../utils/handleAsync';
import { generateToken, generateRefreshToken } from '../utils/generateToken';

/**
 * GET /api/public/bots/:botId/user/:username
 *
 * 无需鉴权的公开接口。
 * 返回该 Telegram 用户（username）在指定公共 bot 下参与的群组列表。
 * 只查 type=public 的 bot，防止滥用。
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

    // 5. 构造列表查询条件
    const queryCond: any = {
      isOnline: true,
      bot: bot._id,
      _id: { $in: botUser.groups },
    };

    // 后端过滤 group/channel 类型
    if (type === 'channel') {
      queryCond.type = 'channel';
    } else if (type === 'group') {
      queryCond.type = { $ne: 'channel' }; // 排除 channel 即为群组
    }

    // 搜索关键词（支持 title 和 username）
    if (keyword) {
      const regex = new RegExp(keyword as string, 'i');
      queryCond.$or = [{ title: regex }, { username: regex }];
    }

    // 6. 并行查询：当前过滤条件下的总数 + 当前页群组/频道列表
    // 注意：如果有 Virtual Populate，不能直接使用 .lean()，或者使用 lean({ virtuals: true })
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

    // 7. 并行统计顶部卡片的“群组总数”和“频道总数”
    const [groupCount, channelCount] = await Promise.all([
      Group.countDocuments({
        isOnline: true,
        bot: bot._id,
        _id: { $in: botUser.groups },
        type: { $ne: 'channel' },
      }),
      Group.countDocuments({
        isOnline: true,
        bot: bot._id,
        _id: { $in: botUser.groups },
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
        groups, // Mongoose 填充后会自动带有 memberCount
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
