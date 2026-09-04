import { Request, Response } from 'express';
import Bot from '../models/bot';
import BotUser from '../models/botUser';
import handleAsync from '../utils/handleAsync';

/**
 * GET /api/public/bots/:botId/user/:username
 *
 * 无需鉴权的公开接口。
 * 返回该 Telegram 用户（username）在指定公共 bot 下参与的群组列表。
 * 只查 type=public 的 bot，防止滥用。
 */
export const getPublicBotGroupsForUser = handleAsync(
  async (req: Request, res: Response) => {
    const { botId, username } = req.params;

    // 只允许查询 public bot
    const bot = await Bot.findOne({ _id: botId, type: 'public' })
      .populate('groups');

    if (!bot) {
      res.status(404);
      throw new Error('Bot 不存在或非公共机器人');
    }

    // 找到该 Telegram 用户的 BotUser 记录
    const cleanUsername = username.replace(/^@/, '');
    const botUser = await BotUser.findOne({ 
      userName: cleanUsername,
      bot: botId 
    }).populate('groups');

    if (!botUser) {
      res.json({ success: true, data: { bot, groups: [] } });
      return;
    }

    res.json({
      success: true,
      data: {
        bot
      },
    });
  },
);

/**
 * GET /api/public/bots/:botId/userid/:tgUserId
 *
 * 无需鉴权的公开接口，通过 Telegram User ID 查询。
 * 返回该 Telegram 用户在指定公共 bot 下参与的群组列表。
 */
export const getPublicBotGroupsForUserId = handleAsync(
  async (req: Request, res: Response) => {
    const { botId, tgUserId } = req.params;

    // 只允许查询 public bot
    const bot = await Bot.findOne({ _id: botId, type: 'public' })
      .populate('groups');

    if (!bot) {
      res.status(404);
      throw new Error('Bot 不存在或非公共机器人');
    }

    // 通过 Telegram User ID 查找 BotUser
    const botUser = await BotUser.findOne({ 
      id: tgUserId,
      bot: botId 
    }).populate('groups');

    if (!botUser) {
      res.json({ success: true, data: { bot, groups: [] } });
      return;
    }
   

    res.json({
      success: true,
      data: {
        bot

      },
    });
  },
);
