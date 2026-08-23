import { Request, Response } from 'express';
import NightMode from '../models/nightMode';
import Bot from '../models/bot';
import Group from '../models/group';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from '../types/user';
import { isProxy } from '../middlewares/authMiddleware';
import { setupBot } from '../bot/botSetup';

const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  const botId = req.tenant || queryParams.botId;
  if (botId) query.bot = botId;

  if (queryParams.groupId) query.group = queryParams.groupId;

  if (isProxy(req.user) && !req.user.isAdmin) {
    query.proxy = req.user._id;
  }

  return query;
};

export const getNightModes = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '50' } = req.query;
    const query = await buildQuery(req.query, req);

    const total = await NightMode.countDocuments(query);
    const data = await NightMode.find(query)
      .populate('bot', 'botName userName')
      .populate('group', 'title username id')
      .populate('proxy', 'name')
      .sort({ createdAt: -1 })
      .skip((Number(current) - 1) * Number(pageSize))
      .limit(Number(pageSize));

    res.json({
      success: true,
      data,
      total,
      current: Number(current),
      pageSize: Number(pageSize),
    });
  },
);

export const getNightModeById = handleAsync(
  async (req: Request, res: Response) => {
    const doc = await NightMode.findById(req.params.id)
      .populate('bot', 'botName userName')
      .populate('group', 'title username id')
      .populate('proxy', 'name');

    if (!doc) {
      res.status(404);
      throw new Error('夜间模式配置不存在');
    }

    res.json({ success: true, data: doc });
  },
);

export const getNightModeByBotAndGroup = handleAsync(
  async (req: Request, res: Response) => {
    const { botId, groupId } = req.query;

    if (!botId || !groupId) {
      res.status(400);
      throw new Error('缺少 botId 或 groupId 参数');
    }

    const doc = await NightMode.findOne({ bot: botId, group: groupId })
      .populate('bot', 'botName userName')
      .populate('group', 'title username id')
      .populate('proxy', 'name');

    res.json({ success: true, data: doc || null });
  },
);

export const createNightMode = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const body = req.body;

    if (!body.bot) {
      res.status(400);
      throw new Error('缺少 bot 参数');
    }
    if (!body.group) {
      res.status(400);
      throw new Error('缺少 group 参数');
    }

    const bot = await Bot.findById(body.bot);
    if (!bot) {
      res.status(404);
      throw new Error('机器人不存在');
    }

    const group = await Group.findById(body.group);
    if (!group || !bot.groups.some((g: any) => g.toString() === body.group)) {
      res.status(400);
      throw new Error('指定的群组不属于该机器人');
    }

    const existing = await NightMode.findOne({
      bot: body.bot,
      group: body.group,
    });
    if (existing) {
      res.status(400);
      throw new Error('该群组已存在夜间模式配置，请直接编辑');
    }

    const doc = await NightMode.create({ ...body, proxy: req.proxyUser._id });
    const populated = await NightMode.findById(doc._id)
      .populate('bot', 'botName userName')
      .populate('group', 'title username id')
      .populate('proxy', 'name');

    res.status(201).json({
      success: true,
      data: populated,
      message: '夜间模式配置创建成功',
    });
  },
);

export const updateNightMode = handleAsync(
  async (req: Request, res: Response) => {
    const doc = await NightMode.findById(req.params.id);
    if (!doc) {
      res.status(404);
      throw new Error('夜间模式配置不存在');
    }

    // 检测到 isActive 从 true 改为 false 且当前处于禁言状态
    // → 先调用 Telegram API 解禁，失败则拒绝更新，保持数据库与 Telegram 状态一致
    const turningOff =
      req.body.isActive === false && doc.isActive === true && doc.isBanned;

    if (turningOff) {
      const bot = await Bot.findById(doc.bot);
      const group = await Group.findById(doc.group);

      if (bot && group && bot.isOnline) {
        const telegramBot = setupBot(bot.token);
        await telegramBot.api.setChatPermissions(group.id, {
          can_send_messages: true,
          can_send_audios: true,
          can_send_documents: true,
          can_send_photos: true,
          can_send_videos: true,
          can_send_video_notes: true,
          can_send_voice_notes: true,
          can_send_polls: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true,
          can_change_info: false,
          can_invite_users: true,
          can_pin_messages: false,
          can_manage_topics: false,
        });
        // Telegram 解禁成功，同步重置 isBanned
        req.body.isBanned = false;
      }
    }

    const updated = await NightMode.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('bot', 'botName userName')
      .populate('group', 'title username id')
      .populate('proxy', 'name');

    res.json({ success: true, data: updated, message: '夜间模式配置更新成功' });
  },
);

export const deleteNightMode = handleAsync(
  async (req: Request, res: Response) => {
    const doc = await NightMode.findById(req.params.id);
    if (!doc) {
      res.status(404);
      throw new Error('夜间模式配置不存在');
    }

    await NightMode.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: '夜间模式配置删除成功' });
  },
);

export const deleteMultipleNightModes = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400);
      throw new Error('请提供要删除的配置 ID');
    }

    const result = await NightMode.deleteMany({ _id: { $in: ids } });
    res.json({
      success: true,
      message: `成功删除 ${result.deletedCount} 条配置`,
    });
  },
);
