import { Request, Response } from 'express';
import RedPacket from '../models/redPacket';
import RedPacketClaim from '../models/redPacketClaim';
import BotUser from '../models/botUser';
import Bot from '../models/bot';
import Group from '../models/group';
import BotUserConfig from '../models/botUserConfig';
import handleAsync from '../utils/handleAsync';
import { findBotProxy } from '../bot/services/findBotProxy';
import { setupBot } from '../bot/botSetup';
import { InlineKeyboard } from 'grammy';
import { buildRedPacketMessage } from '../bot/commands/user/redpacket/buildRedPacketMessage';
import { sendMediaMessage } from '../utils/sendMultiMedia';

// ─── 查询构建 ──────────────────────────────────────────────────────────────────

const buildQuery = async (queryParams: any): Promise<any> => {
  const query: any = {};

  if (queryParams.botId) {
    query.bot = queryParams.botId;
  } else if (queryParams.bot) {
    const bots = await Bot.find({
      botName: { $regex: queryParams.bot, $options: 'i' },
    });
    query.bot = bots.length > 0 ? { $in: bots.map((b) => b._id) } : null;
  }

  if (queryParams.groupId) {
    query.group = queryParams.groupId;
  }

  if (queryParams.creatorId) {
    query.creator = queryParams.creatorId;
  } else if (queryParams.creator) {
    const users = await BotUser.find({
      userName: { $regex: queryParams.creator, $options: 'i' },
    });
    query.creator = users.length > 0 ? { $in: users.map((u) => u._id) } : null;
  }

  if (queryParams.status) {
    query.status = queryParams.status;
  }

  return query;
};

// ─── 红包列表 ──────────────────────────────────────────────────────────────────

export const getRedPackets = handleAsync(
  async (req: Request, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = await buildQuery(req.query);

    const data = await RedPacket.find(query)
      .sort('-createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .populate('bot', 'botName userName')
      .populate('group', 'name title')
      .populate('creator', 'userName firstName lastName')
      .populate('proxy', 'name email')
      .lean()
      .exec();

    const total = await RedPacket.countDocuments(query).exec();

    res.json({
      success: true,
      data,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

// ─── 红包详情（含领取记录） ────────────────────────────────────────────────────

export const getRedPacketById = handleAsync(
  async (req: Request, res: Response) => {
    const record = await RedPacket.findById(req.params.id)
      .populate('bot', 'botName userName')
      .populate('group', 'name title')
      .populate('creator', 'userName firstName lastName')
      .populate('proxy', 'name email')
      .lean();

    if (!record) {
      res.status(404);
      throw new Error('红包不存在');
    }

    // 单独查领取记录
    const claims = await RedPacketClaim.find({ redPacket: record._id })
      .sort('createdAt')
      .populate('botUser', 'userName firstName lastName')
      .lean();

    res.json({ success: true, data: { ...record, claims } });
  },
);

// ─── 某红包的领取记录列表 ──────────────────────────────────────────────────────

export const getRedPacketClaims = handleAsync(
  async (req: Request, res: Response) => {
    const { current = '1', pageSize = '20' } = req.query;

    const claims = await RedPacketClaim.find({ redPacket: req.params.id })
      .sort('createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .populate('botUser', 'userName firstName lastName')
      .lean();

    const total = await RedPacketClaim.countDocuments({
      redPacket: req.params.id,
    });

    res.json({
      success: true,
      data: claims,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

// ─── 删除单条 ──────────────────────────────────────────────────────────────────

export const deleteRedPacket = handleAsync(
  async (req: Request, res: Response) => {
    const record = await RedPacket.findById(req.params.id);
    if (!record) {
      res.status(404);
      throw new Error('红包不存在');
    }

    await RedPacketClaim.deleteMany({ redPacket: record._id });
    await record.deleteOne();

    res.json({ success: true, message: '红包已删除' });
  },
);

// ─── 批量删除 ──────────────────────────────────────────────────────────────────

export const deleteMultipleRedPackets = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;
    await RedPacketClaim.deleteMany({ redPacket: { $in: ids } });
    await RedPacket.deleteMany({ _id: { $in: ids } });

    res.json({ success: true, message: '红包批量删除成功' });
  },
);

// ─── Public：Web App 创建红包 ──────────────────────────────────────────────────

export const createRedPacketPublic = handleAsync(
  async (req: Request, res: Response) => {
    const {
      botId,
      botUserId,
      groupId,
      totalPoints,
      totalSlots,
      bombNumbers = [],
      bombMultiplier = 1.2,
      expireMinutes = 30,
      backgroundUrl,
    } = req.body;

    // 基础校验
    if (!botId || !botUserId || !groupId) {
      res.status(400);
      throw new Error('缺少必要参数');
    }
    if (!totalPoints || totalPoints < 1) {
      res.status(400);
      throw new Error('积分数量无效');
    }
    if (!totalSlots || totalSlots < 1) {
      res.status(400);
      throw new Error('份数无效');
    }
    if (bombNumbers.length >= totalSlots) {
      res.status(400);
      throw new Error('炸弹数字数量不能大于等于总份数');
    }

    const bot = await Bot.findById(botId);
    if (!bot) {
      res.status(404);
      throw new Error('Bot 不存在');
    }

    const botUser = await BotUser.findById(botUserId);
    if (!botUser) {
      res.status(404);
      throw new Error('用户不存在');
    }

    // 获取 BotUserConfig（余额）
    const config = await BotUserConfig.findOne({
      bot: botId,
      botUser: botUserId,
    });
    if (!config) {
      res.status(404);
      throw new Error('用户配置不存在');
    }

    const creatorPointsBefore = config.usdt_balance || 0;

    if (creatorPointsBefore < totalPoints) {
      res.status(400);
      throw new Error(`积分不足，当前余额 ${creatorPointsBefore}`);
    }

    // 获取代理用户
    const { proxyUser } = await findBotProxy(bot);

    // 扣除发起人积分
    config.usdt_balance = creatorPointsBefore - totalPoints;
    await config.save();

    const expiredAt = new Date(Date.now() + expireMinutes * 60 * 1000);

    const redPacket = await RedPacket.create({
      proxy: proxyUser?._id,
      bot: botId,
      group: groupId,
      creator: botUserId,
      totalPoints,
      totalSlots,
      remainingAmount: totalPoints,
      bombNumbers,
      bombMultiplier,
      expiredAt,
      creatorPointsBefore,
      backgroundUrl: backgroundUrl || undefined,
      status: 'active',
    });

    // 用 setupBot 建 bot 实例，直接调 Telegram API 在群里发红包消息
    try {
      const group = await Group.findById(groupId).lean();
      const chatId = group?.id; // Group.id 是 Telegram chat id（number）

      if (chatId) {
        const botInstance = setupBot(bot.token);

        const creatorName = botUser.userName
          ? `@${botUser.userName}`
          : botUser.firstName || '用户';

        const text = await buildRedPacketMessage(redPacket, creatorName);

        const keyboard = new InlineKeyboard().text(
          `🧧 抢红包（0/${totalSlots}）`,
          `grab_rp_${redPacket._id}`,
        );

        let sent;
        if (backgroundUrl) {
          // 从 URL 中取出文件名，用 sendMediaMessage 走本地文件流发送
          // backgroundUrl 格式: http://xxx/api/static/<filename>
          const fileName = backgroundUrl.split('/api/static/').pop();
          const result = await sendMediaMessage(
            botInstance.api,
            chatId,
            [fileName],
            {
              caption: text,
              parse_mode: 'HTML',
              reply_markup: keyboard,
            },
          );
          sent = result.message_id ? { message_id: result.message_id } : null;
        } else {
          sent = await botInstance.api.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: keyboard,
          });
        }

        await RedPacket.findByIdAndUpdate(redPacket._id, {
          messageId: sent.message_id,
        });
      }
    } catch (e) {
      console.error('[createRedPacketPublic] 发送群消息失败:', e);
      // 不影响红包创建，消息发失败只记录日志
    }

    res.status(201).json({ success: true, data: { _id: redPacket._id } });
  },
);

// ─── Public：获取可发红包的群列表 ──────────────────────────────────────────────

export const getGroupsForRedPacket = handleAsync(
  async (req: Request, res: Response) => {
    const { botId, botUserId } = req.query;

    if (!botId || !botUserId) {
      res.status(400);
      throw new Error('缺少 botId 或 botUserId');
    }

    // 该 bot 管辖、且 botUsers 数组包含该 botUser 的群
    const groups = await Group.find({
      bot: botId,
      botUsers: botUserId,
    })
      .select('_id id title username')
      .lean();

    res.json({ success: true, data: groups });
  },
);

// ─── Public：我发出的红包历史 ──────────────────────────────────────────────────

export const getSentRedPackets = handleAsync(
  async (req: Request, res: Response) => {
    const { botId, botUserId, current = '1', pageSize = '10' } = req.query;

    if (!botId || !botUserId) {
      res.status(400);
      throw new Error('缺少 botId 或 botUserId');
    }

    const query = { bot: botId, creator: botUserId };

    const data = await RedPacket.find(query)
      .sort('-createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .populate('group', 'title username')
      .lean();

    const total = await RedPacket.countDocuments(query);

    // 附加每条红包的领取数
    const ids = data.map((r) => r._id);
    const claimCounts = await RedPacketClaim.aggregate([
      { $match: { redPacket: { $in: ids } } },
      { $group: { _id: '$redPacket', count: { $sum: 1 } } },
    ]);
    const claimMap: Record<string, number> = {};
    claimCounts.forEach((c) => {
      claimMap[c._id.toString()] = c.count;
    });

    const result = data.map((r) => ({
      ...r,
      claimedCount: claimMap[r._id.toString()] ?? 0,
    }));

    res.json({
      success: true,
      data: result,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

// ─── Public：我领取的红包历史 ──────────────────────────────────────────────────

export const getClaimedRedPackets = handleAsync(
  async (req: Request, res: Response) => {
    const { botId, botUserId, current = '1', pageSize = '10' } = req.query;

    if (!botId || !botUserId) {
      res.status(400);
      throw new Error('缺少 botId 或 botUserId');
    }

    const total = await RedPacketClaim.countDocuments({ botUser: botUserId });

    const claims = await RedPacketClaim.find({ botUser: botUserId })
      .sort('-createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .populate({
        path: 'redPacket',
        match: { bot: botId },
        select: 'totalPoints totalSlots status group createdAt creator',
        populate: [
          { path: 'group', select: 'title username' },
          { path: 'creator', select: 'userName firstName lastName' },
        ],
      })
      .lean();

    // 过滤掉 redPacket 为 null（不属于该 bot）的记录
    const filtered = claims.filter((c) => c.redPacket != null);

    res.json({
      success: true,
      data: filtered,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);
