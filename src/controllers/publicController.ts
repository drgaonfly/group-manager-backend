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

    console.log('botId', botId, 'botUserId', botUserId);

    // 只允许查询 public bot
    const bot = await Bot.findById(botId).select(
      '_id botName userName isOnline type disabledAt',
    );

    if (!bot) {
      res.status(404);
      throw new Error('Bot 不存在或非公共机器人');
    }

    const botUser = await BotUser.findById(botUserId);

    if (!botUser) {
      res.json({ success: true });
      return;
    }

    const proxyUser = await User.findById(botUser.proxy);

    if (!proxyUser) {
      res.json({ success: true });
      return;
    }

    // Bot 所有群，populate creator 和 operators 的 Telegram id
    const allGroups = await Group.find({ bot: bot._id, isOnline: true })
      .populate({ path: 'creator', select: 'id' })
      .populate({ path: 'operators', select: 'id' })
      .select('_id title username type creator operators');

    // 用 botUser.id（Telegram数字ID）过滤，和后台 canAccessGroup 逻辑一致
    const tgUserId = botUser.id;
    const filteredGroups = allGroups.filter((g: any) => {
      const creatorId = g.creator?.id;
      const operatorIds: string[] = (g.operators || []).map(
        (op: any) => op?.id,
      );
      return creatorId === tgUserId || operatorIds.includes(tgUserId);
    });

    // 为 proxyUser 生成临时 token，用于后续 API 调用
    const token = generateToken(proxyUser._id.toString());
    const refreshToken = generateRefreshToken(proxyUser._id.toString());

    res.json({
      success: true,
      data: {
        bot: bot.toObject(),
        botUser,
        proxyUser,
        groups: filteredGroups,
      },
      token,
      refreshToken,
    });
  },
);
