import { Request, Response } from 'express';
import Auction from '../models/auction';
import Bot from '../models/bot';
import Group from '../models/group';
import BotUserConfig from '../models/botUserConfig';
import { setupBot } from '../bot/botSetup';
import { formatBeijingDate } from '../utils/formatBeijingDate';
import { findBotProxy } from '../bot/services/findBotProxy';
import {
  replaceAuctionVariables,
  replaceAuctionEndVariables,
} from '../utils/replaceVariables';
import { convertToTelegramHtml } from '../bot/utils/telegramHtml';
import { InlineKeyboard } from 'grammy';
import { RequestCustom } from '../types/user';

// 获取竞拍列表
export const getAuctions = async (req: Request, res: Response) => {
  const { botId, status, current = 1, pageSize = 10 } = req.query;
  const query: any = {};

  if (botId) {
    query.bot = botId;
  }
  if (status) {
    query.status = status;
  }

  const total = await Auction.countDocuments(query);
  const data = await Auction.find(query)
    .populate('bot', 'botName userName')
    .populate('group', 'title username')
    .sort({ createdAt: -1 })
    .skip((Number(current) - 1) * Number(pageSize))
    .limit(Number(pageSize));

  res.json({
    data,
    total,
    success: true,
    current: Number(current),
    pageSize: Number(pageSize),
  });
};

// 获取单个竞拍
export const getAuction = async (req: Request, res: Response) => {
  const auction = await Auction.findById(req.params.id)
    .populate('bot', 'botName userName')
    .populate('group', 'title username')
    .populate('winner', 'telegramId username firstName lastName');

  if (!auction) {
    res.status(404).json({ message: '竞拍活动不存在' });
    return;
  }
  res.json(auction);
};

// 创建竞拍
export const createAuction = async (req: RequestCustom, res: Response) => {
  const { bot: botId, ...data } = req.body;

  console.log('=== 🏆 后台创建竞拍活动 ===');
  console.log('📥 接收到的数据:', {
    botId,
    title: data.title,
    group: data.group,
    startingPrice: data.startingPrice,
    bidIncrement: data.bidIncrement,
    endTime: data.endTime,
    isPinned: data.isPinned,
  });

  try {
    const bot = await Bot.findById(botId);
    if (!bot) {
      res.status(404).json({ message: '机器人不存在' });
      return;
    }

    // 验证群组是否属于该机器人
    const group = await Group.findById(data.group);
    if (!group || !bot.groups.includes(data.group)) {
      res.status(400).json({ message: '指定的群组不属于该机器人' });
      return;
    }

    // 检查该群组是否已有进行中的竞拍活动（不依赖 endTime，以 status 为准）
    const existingAuction = await Auction.findOne({
      bot: botId,
      group: data.group,
      status: 'ongoing',
    });

    if (existingAuction) {
      res.status(400).json({
        message: `该群组已有进行中的竞拍活动："${existingAuction.title}"，请等待其结束后再创建新的竞拍`,
      });
      return;
    }

    const { proxyUser } = await findBotProxy(bot);

    const auction = await Auction.create({
      ...data,
      bot: botId,
      proxy: proxyUser._id,
    });

    console.log('✅ 后台竞拍活动已保存到数据库:', {
      id: auction._id,
      title: auction.title,
      group: group.title,
    });

    // 发送竞拍通知到指定群组
    console.log('📢 开始发送竞拍通知到群组...');
    await sendAuctionNotification(auction, bot, group);

    res.status(201).json(auction);
  } catch (error: any) {
    console.error('❌ 后台创建竞拍失败:', error);
    res.status(500).json({ message: error.message || '创建失败' });
  }
};

// 更新竞拍
export const updateAuction = async (req: Request, res: Response) => {
  const auction = await Auction.findById(req.params.id);
  if (!auction) {
    res.status(404).json({ message: '竞拍活动不存在' });
    return;
  }

  if (auction.status === 'completed') {
    res.status(400).json({ message: '已完成的竞拍活动不能修改' });
    return;
  }

  // 如果要修改群组，检查目标群组是否已有进行中的竞拍（以 status 为准）
  if (req.body.group && req.body.group !== auction.group.toString()) {
    const existingAuction = await Auction.findOne({
      bot: auction.bot,
      group: req.body.group,
      status: 'ongoing',
      _id: { $ne: auction._id }, // 排除当前竞拍
    });

    if (existingAuction) {
      res.status(400).json({
        message: `目标群组已有进行中的竞拍活动："${existingAuction.title}"，请等待其结束后再修改`,
      });
      return;
    }
  }

  const updated = await Auction.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  }).populate('group', 'title username');

  res.json(updated);
};

// 删除竞拍
export const deleteAuction = async (req: Request, res: Response) => {
  const auction = await Auction.findById(req.params.id);
  if (!auction) {
    res.status(404).json({ message: '竞拍活动不存在' });
    return;
  }

  await Auction.findByIdAndDelete(req.params.id);
  res.json({ message: '删除成功' });
};

// 获取竞拍出价记录
export const getAuctionBids = async (req: Request, res: Response) => {
  const { current = 1, pageSize = 10 } = req.query;

  const auction = await Auction.findById(req.params.id);
  if (!auction) {
    res.status(404).json({ message: '竞拍活动不存在' });
    return;
  }

  // 按出价时间倒序排列
  const sortedBids = auction.bids.sort(
    (a, b) => new Date(b.bidTime).getTime() - new Date(a.bidTime).getTime(),
  );

  const total = sortedBids.length;
  const startIndex = (Number(current) - 1) * Number(pageSize);
  const endIndex = startIndex + Number(pageSize);
  const data = sortedBids.slice(startIndex, endIndex);

  res.json({
    data,
    total,
    success: true,
    current: Number(current),
    pageSize: Number(pageSize),
  });
};

// 手动结束竞拍
export const endAuction = async (req: Request, res: Response) => {
  const auction = await Auction.findById(req.params.id)
    .populate('bot', 'token userName botName')
    .populate('group', 'id title');

  if (!auction) {
    res.status(404).json({ message: '竞拍活动不存在' });
    return;
  }

  if (auction.status === 'completed') {
    res.status(400).json({ message: '该竞拍活动已完成' });
    return;
  }

  await executeAuctionEnd(auction);

  res.json({
    message: '竞拍已结束',
    auction,
  });
};

// 执行竞拍结束逻辑
export const executeAuctionEnd = async (auction: any) => {
  // 原子性更新：只有 status 为 ongoing 时才能结束，防止并发重复执行
  const updated = await Auction.findOneAndUpdate(
    { _id: auction._id, status: 'ongoing' },
    { $set: { status: 'completed', completedAt: new Date() } },
    { new: false }, // 返回更新前的文档，用于判断是否真的执行了更新
  );

  if (!updated) {
    // 已经被其他进程结束了，直接返回
    console.log(`[竞拍] ${auction._id} 已结束，跳过重复执行`);
    return;
  }

  // 重新从数据库读取最新状态（含 populate）
  const freshAuction = await Auction.findById(auction._id)
    .populate('bot', 'token userName botName')
    .populate('group', 'id title');

  if (!freshAuction) return;

  // 确保 auction 对象的引用也更新（供后续逻辑使用）
  auction.status = 'completed';
  auction.completedAt = freshAuction.completedAt;

  // 无人出价的情况
  if (freshAuction.bids.length === 0) {
    // 群通知：无人参与
    const freshBot = freshAuction.bot as any;
    const freshGroup = freshAuction.group as any;
    if (freshBot?.token && freshGroup?.id) {
      try {
        const telegramBot = setupBot(freshBot.token);
        await telegramBot.api.sendMessage(
          freshGroup.id,
          `📢 竞拍活动"${freshAuction.title}"已结束\n\n😔 本次竞拍无人参与`,
          { parse_mode: 'HTML' },
        );
      } catch (error) {
        console.error('发送竞拍结束群通知失败:', error);
      }
    }
    return;
  }

  // 找到最高出价
  const highestBid = freshAuction.bids.reduce((highest: any, current: any) =>
    current.bidAmount > highest.bidAmount ? current : highest,
  );

  // 记录获胜者信息（状态已由原子更新写入，这里只补充 winner/winningBid）
  await Auction.findByIdAndUpdate(freshAuction._id, {
    $set: {
      winner: highestBid.botUser,
      winningBid: highestBid.bidAmount,
    },
  });

  // 扣除获胜者积分
  const winnerConfig = await BotUserConfig.findOne({
    botUser: highestBid.botUser,
  });

  if (winnerConfig) {
    winnerConfig.usdt_balance =
      (winnerConfig.usdt_balance || 0) - highestBid.bidAmount;
    await winnerConfig.save();
  }

  const winnerName =
    highestBid.firstName ||
    (highestBid.username ? `@${highestBid.username}` : null) ||
    `用户${highestBid.telegramId}`;

  const endTime = formatBeijingDate(freshAuction.completedAt || new Date());

  // 统计参与人数（去重）
  const participantCount = new Set(
    freshAuction.bids.map((b: any) => b.telegramId),
  ).size;

  const bot = freshAuction.bot as any;
  const group = freshAuction.group as any;

  // 1. 发送私信给获胜者
  if (bot?.token) {
    try {
      const telegramBot = setupBot(bot.token);
      await telegramBot.api.sendMessage(
        highestBid.telegramId,
        `🎉 恭喜您在竞拍活动"${freshAuction.title}"中获胜！\n\n${freshAuction.auctionResult}`,
        { parse_mode: 'HTML' },
      );
    } catch (error) {
      console.error('发送获胜私信失败:', error);
    }
  }

  // 2. 在群里发送结束通知
  if (bot?.token && group?.id) {
    try {
      const telegramBot = setupBot(bot.token);

      // 构建结束通知内容
      let endMessage = freshAuction.endNotifyContent || '';

      if (endMessage) {
        endMessage = replaceAuctionEndVariables(endMessage, freshAuction, {
          winnerName,
          winningBid: highestBid.bidAmount,
          totalBids: freshAuction.bids.length,
          participantCount,
          endTime,
          currentBot: `@${bot.userName}`,
        });
        endMessage = convertToTelegramHtml(endMessage);
      }

      // 没有配置则用默认模板
      if (!endMessage.trim()) {
        endMessage =
          `🏆 竞拍结束：${freshAuction.title}\n\n` +
          `🎉 恭喜获胜者：${winnerName}\n` +
          `💰 获胜出价：${highestBid.bidAmount}积分\n` +
          `📊 总出价次数：${freshAuction.bids.length}\n` +
          `👥 参与人数：${participantCount}\n` +
          `⏰ 结束时间：${endTime}\n\n` +
          `感谢大家的参与！`;
      }

      await telegramBot.api.sendMessage(group.id, endMessage, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
    } catch (error) {
      console.error('发送竞拍结束群通知失败:', error);
    }
  }
};

// 发送竞拍通知的核心函数
const sendAuctionNotification = async (auction: any, bot: any, group: any) => {
  console.log('=== 🏆 sendAuctionNotification 调试信息 ===');
  console.log('📋 竞拍信息:', {
    auctionId: auction._id,
    title: auction.title,
    startingPrice: auction.startingPrice,
    bidIncrement: auction.bidIncrement,
    endTime: auction.endTime,
    isPinned: auction.isPinned,
    botName: bot.botName,
    groupTitle: group.title,
  });

  const telegramBot = setupBot(bot.token);

  // 构建竞拍信息
  const endTime = formatBeijingDate(auction.endTime);

  // 用户配置的通知内容模板，替换变量
  let messageContent = auction.notifyContent || '';
  messageContent = replaceAuctionVariables(messageContent, auction, {
    currentBot: `@${bot.userName}`,
    endTime,
    currentHighestBid: auction.startingPrice,
    bidCount: 0,
  });

  // 如果没有自定义内容，使用默认模板
  if (!messageContent.trim()) {
    messageContent =
      `🏆 竞拍活动：${auction.title}\n\n` +
      `💰 起拍价：${auction.startingPrice}积分\n` +
      `📈 加价区间：${auction.minBidIncrement}-${auction.maxBidIncrement}积分\n` +
      `⏰ 结束时间：${endTime}\n\n` +
      `💡 参与方式：回复"竞拍"参与竞拍`;
  }

  const keyboard = new InlineKeyboard();

  // 添加参与竞拍按钮
  keyboard.text('🏆 参与竞拍', `auction_join_${auction._id}`);

  console.log('📤 发送参数:', {
    messageLength: messageContent.length,
    hasKeyboard: !!keyboard,
    groupId: group.id,
    groupTitle: group.title,
    isPinned: auction.isPinned,
  });

  try {
    console.log(`📨 发送到群组: ${group.title} (${group.id})`);

    // 转换HTML为Telegram兼容格式
    const telegramMessage = convertToTelegramHtml(messageContent);

    const sentMessage = await telegramBot.api.sendMessage(
      group.id,
      telegramMessage,
      {
        parse_mode: 'HTML',
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true },
      },
    );

    // 置顶消息
    if (auction.isPinned && sentMessage.message_id) {
      try {
        await telegramBot.api.pinChatMessage(group.id, sentMessage.message_id);
        console.log('📌 消息已置顶');
      } catch (e) {
        console.error('置顶竞拍通知失败:', e);
      }
    }

    console.log(`✅ 成功发送到群组: ${group.title}`);
  } catch (err) {
    console.error(`❌ 发送竞拍通知到群组 ${group.title} 失败:`, err);
    throw err;
  }

  console.log('=== 🏆 sendAuctionNotification 结束 ===\n');
};

// 公开接口：创建竞拍（无需登录，供群管理员使用）
export const createAuctionPublic = async (
  req: RequestCustom,
  res: Response,
) => {
  const { botId, botUserId, ...data } = req.body;

  console.log('=== 🏆 创建竞拍活动 ===');
  console.log('📥 接收到的数据:', data);

  if (!botId) {
    res.status(400).json({ message: '缺少机器人参数' });
    return;
  }

  // 验证必填字段
  const requiredFields = [
    'title',
    'group',
    'startingPrice',
    'bidIncrement',
    'endTime',
    'auctionResult',
  ];
  for (const field of requiredFields) {
    if (!data[field]) {
      res.status(400).json({ message: `请填写${field}字段` });
      return;
    }
  }

  try {
    const bot = await Bot.findById(botId);
    if (!bot) {
      res.status(404).json({ message: '机器人不存在' });
      return;
    }

    const { proxyUser } = await findBotProxy(bot);

    // 验证群组
    const group = await Group.findById(data.group);
    if (!group || !bot.groups.includes(data.group)) {
      res.status(400).json({ message: '指定的群组不属于该机器人' });
      return;
    }

    // 检查该群组是否已有进行中的竞拍活动（不依赖 endTime，以 status 为准）
    const existingAuction = await Auction.findOne({
      bot: botId,
      group: data.group,
      status: 'ongoing',
    });

    if (existingAuction) {
      res.status(400).json({
        message: `该群组已有进行中的竞拍活动："${existingAuction.title}"，请等待其结束后再创建新的竞拍`,
      });
      return;
    }

    const auctionData = {
      ...data,
      bot: botId,
      proxy: proxyUser._id,
      creator: botUserId || null,
      status: 'ongoing',
    };

    const auction = await Auction.create(auctionData);

    console.log('✅ 竞拍活动已保存到数据库:', {
      id: auction._id,
      title: auction.title,
    });

    // 发送竞拍通知
    console.log('📢 开始发送竞拍通知...');
    await sendAuctionNotification(auction, bot, group);

    res.status(201).json({
      success: true,
      data: auction,
      message: '竞拍活动创建成功',
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || '创建失败' });
  }
};

// 公开接口：获取用户创建的竞拍列表（无需登录）
export const getAuctionsByCreator = async (req: Request, res: Response) => {
  const { botUserId } = req.query;

  if (!botUserId) {
    res.status(400).json({ message: '缺少用户参数' });
    return;
  }

  try {
    const auctions = await Auction.find({ creator: botUserId })
      .populate('bot', 'botName userName')
      .populate('group', 'title username')
      .sort({ createdAt: -1 })
      .limit(20)
      .exec();

    res.json({
      success: true,
      data: auctions,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || '获取失败' });
  }
};

// 公开接口：获取单个竞拍详情（无需登录）
export const getAuctionPublic = async (req: Request, res: Response) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate('bot', 'botName userName')
      .populate('group', 'title username')
      .populate('winner', 'telegramId username firstName lastName')
      .exec();

    if (!auction) {
      res.status(404).json({ message: '竞拍活动不存在' });
      return;
    }

    res.json({
      success: true,
      data: auction,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || '获取失败' });
  }
};

// 公开接口：获取竞拍出价记录（无需登录）
export const getAuctionBidsPublic = async (req: Request, res: Response) => {
  try {
    const { auctionId, current = 1, pageSize = 10 } = req.query;

    if (!auctionId) {
      res.status(400).json({ message: '缺少竞拍ID参数' });
      return;
    }

    const auction = await Auction.findById(auctionId);
    if (!auction) {
      res.status(404).json({ message: '竞拍活动不存在' });
      return;
    }

    // 按出价时间倒序排列
    const sortedBids = auction.bids.sort(
      (a, b) => new Date(b.bidTime).getTime() - new Date(a.bidTime).getTime(),
    );

    const total = sortedBids.length;
    const startIndex = (Number(current) - 1) * Number(pageSize);
    const endIndex = startIndex + Number(pageSize);
    const data = sortedBids.slice(startIndex, endIndex);

    res.json({
      success: true,
      data,
      total,
      current: Number(current),
      pageSize: Number(pageSize),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || '获取失败' });
  }
};

// 公开接口：取消竞拍（无需登录）
export const cancelAuctionPublic = async (req: Request, res: Response) => {
  try {
    const { auctionId } = req.body;

    if (!auctionId) {
      res.status(400).json({ message: '缺少竞拍ID参数' });
      return;
    }

    const auction = await Auction.findById(auctionId);
    if (!auction) {
      res.status(404).json({ message: '竞拍活动不存在' });
      return;
    }

    if (auction.status === 'completed') {
      res.status(400).json({ message: '已完成的竞拍无法取消' });
      return;
    }

    auction.status = 'completed';
    auction.completedAt = new Date();
    await auction.save();

    res.json({
      success: true,
      message: '竞拍已取消',
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || '取消失败' });
  }
};
