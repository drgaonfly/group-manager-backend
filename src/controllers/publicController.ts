import { Request, Response } from 'express';
import Bot from '../models/bot';
import BotUser from '../models/botUser';
import Group from '../models/group';
import handleAsync from '../utils/handleAsync';

/**
 * GET /api/public/bots/:botId/:username
 *
 * 无需鉴权的公开接口。
 * 返回该 Telegram 用户（username）在指定公共 bot 下参与的群组列表。
 * 只查 type=public 的 bot，防止滥用。
 */
export const getPublicBotGroupsForUser = handleAsync(
  async (req: Request, res: Response) => {
    const { botId, username } = req.params;

    // 只允许查询 public bot
    const bot = await Bot.findOne({ _id: botId, type: 'public' }).select(
      '_id botName userName type groups',
    );
    if (!bot) {
      res.status(404);
      throw new Error('Bot 不存在或非公共机器人');
    }

    // 找到该 Telegram 用户的 BotUser 记录
    const cleanUsername = username.replace(/^@/, '');
    const botUser = await BotUser.findOne({ userName: cleanUsername });
    if (!botUser) {
      res.json({ success: true, data: { bot, groups: [] } });
      return;
    }

    // 找出该 bot 下、同时包含该 botUser 的群组
    const groups = await Group.find({
      _id: { $in: bot.groups },
      botUsers: botUser._id,
    }).select('_id title username type');

    res.json({
      success: true,
      data: {
        bot: {
          _id: bot._id,
          botName: bot.botName,
          userName: bot.userName,
        },
        botUser: {
          _id: botUser._id,
          userName: botUser.userName,
          firstName: botUser.firstName,
          lastName: botUser.lastName,
        },
        groups,
      },
    });
  },
);
