import { Request, Response } from 'express';
import Bot from '../models/bot';
import User from '../models/user';
import BotUser from '../models/botUser';
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
    const bot = await Bot.findById(botId).populate('groups');

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

    // 过滤群组：只返回该 botUser 是 creator 或 operator 的群组
    const allGroups: any[] = (bot.groups as any[]) || [];
    const botUserIdStr = botUser._id.toString();
    const filteredGroups = allGroups.filter((g: any) => {
      const creatorId = g.creator?.toString();
      const operatorIds: string[] = (g.operators || []).map((op: any) =>
        op.toString(),
      );
      return creatorId === botUserIdStr || operatorIds.includes(botUserIdStr);
    });

    // 为 proxyUser 生成临时 token，用于后续 API 调用
    const token = generateToken(proxyUser._id.toString());
    const refreshToken = generateRefreshToken(proxyUser._id.toString());

    res.json({
      success: true,
      data: {
        bot: { ...bot.toObject(), groups: filteredGroups },
        botUser,
        proxyUser,
      },
      token,
      refreshToken,
    });
  },
);
