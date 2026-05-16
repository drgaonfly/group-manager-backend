import { InlineKeyboard } from 'grammy';
import { Request, Response } from 'express';
import Lottery from '../models/lottery';
import LotteryParticipant from '../models/lotteryParticipant';
import Bot from '../models/bot';
import Group from '../models/group';
import { setupBot } from '../bot/botSetup';
import { formatBeijingDate } from '../utils/formatBeijingDate';
import { v4 as uuidv4 } from 'uuid';
import { buildInlineKeyboard } from '../bot/utils/buildInlineKeyboard';
import { sendLotteryMessage } from '../bot/utils/sendLotteryMessage';
import { findBotProxy } from '../bot/services/findBotProxy';
import { replaceLotteryVariables } from '../utils/replaceVariables';
import { RequestCustom } from 'user';

// 生成短唯一码
const generateCode = () => uuidv4().replace(/-/g, '').slice(0, 10);

// 获取抽奖列表
export const getLotteries = async (req: Request, res: Response) => {
  const { botId, status, current = 1, pageSize = 10 } = req.query;
  const query: any = {};

  if (botId) {
    query.bot = botId;
  }
  if (status) {
    query.status = status;
  }

  const total = await Lottery.countDocuments(query);
  const data = await Lottery.find(query)
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

// 获取单个抽奖
export const getLottery = async (req: Request, res: Response) => {
  const lottery = await Lottery.findById(req.params.id).populate(
    'bot',
    'botName userName',
  );
  if (!lottery) {
    res.status(404).json({ message: '抽奖活动不存在' });
    return;
  }
  res.json(lottery);
};

// 创建抽奖
export const createLottery = async (req: RequestCustom, res: Response) => {
  const { bot: botId, ...data } = req.body;

  console.log('=== 🎰 后台创建抽奖活动 ===');
  console.log('📥 接收到的数据:', {
    botId,
    title: data.title,
    group: data.group,
    notifyPin: data.notifyPin,
    notifyPinType: typeof data.notifyPin,
    joinSuccessPin: data.joinSuccessPin,
    drawResultPin: data.drawResultPin,
    media: data.media,
    mediaType: data.mediaType,
    dataKeys: Object.keys(data),
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

    // 检查该群组是否已有进行中的抽奖活动
    const existingLottery = await Lottery.findOne({
      bot: botId,
      group: data.group,
      status: 'ongoing',
    });
    if (existingLottery) {
      res.status(400).json({
        message: `该群组已有进行中的抽奖活动："${existingLottery.title}"，请等待其结束后再创建新的抽奖`,
      });
      return;
    }

    const code = generateCode();
    const { proxyUser } = await findBotProxy(bot);

    // 确保 media 字段是字符串
    if (data.media && typeof data.media === 'object') {
      console.error('Media 字段是对象而不是字符串:', data.media);
      data.media = ''; // 重置为空字符串
    }

    // 清理不需要的字段
    const cleanedData = { ...data };
    if (cleanedData.media === '') {
      delete cleanedData.media;
      delete cleanedData.mediaType;
    }

    const lottery = await Lottery.create({
      ...cleanedData,
      bot: botId,
      proxy: proxyUser._id,
      code,
    });

    console.log('✅ 后台抽奖活动已保存到数据库:', {
      id: lottery._id,
      group: group.title,
    });

    // 发送抽奖通知到指定群组
    console.log('📢 开始发送抽奖通知到群组...');
    await sendLotteryNotifications(lottery, bot, group);

    res.status(201).json(lottery);
  } catch (error: any) {
    console.error('❌ 后台创建抽奖失败:', error);
    res.status(500).json({ message: error.message || '创建失败' });
  }
};

// 更新抽奖
export const updateLottery = async (req: Request, res: Response) => {
  const lottery = await Lottery.findById(req.params.id);
  if (!lottery) {
    res.status(404).json({ message: '抽奖活动不存在' });
    return;
  }

  if (lottery.status === 'completed') {
    res.status(400).json({ message: '已完成的抽奖活动不能修改' });
    return;
  }

  const updated = await Lottery.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });

  res.json(updated);
};

// 删除抽奖
export const deleteLottery = async (req: Request, res: Response) => {
  const lottery = await Lottery.findById(req.params.id);
  if (!lottery) {
    res.status(404).json({ message: '抽奖活动不存在' });
    return;
  }

  await LotteryParticipant.deleteMany({ lottery: lottery._id });
  await Lottery.findByIdAndDelete(req.params.id);

  res.json({ message: '删除成功' });
};

// 获取抽奖参与者列表
export const getLotteryParticipants = async (req: Request, res: Response) => {
  const { current = 1, pageSize = 10 } = req.query;
  const query: any = {};

  // 从路径参数获取 lottery ID
  query.lottery = req.params.id;

  const total = await LotteryParticipant.countDocuments(query);
  const data = await LotteryParticipant.find(query)
    .populate('botUser', 'telegramId username firstName lastName')
    .sort({ joinedAt: -1 })
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

// 手动开奖
export const drawLottery = async (req: Request, res: Response) => {
  const lottery = await Lottery.findById(req.params.id);
  if (!lottery) {
    res.status(404).json({ message: '抽奖活动不存在' });
    return;
  }

  if (lottery.status === 'completed') {
    res.status(400).json({ message: '该抽奖活动已完成' });
    return;
  }

  const participants = await LotteryParticipant.find({
    lottery: lottery._id,
  });

  if (participants.length === 0) {
    res.status(400).json({ message: '暂无参与者，无法开奖' });
    return;
  }

  const winners: any[] = [];
  const shuffled = [...participants].sort(() => Math.random() - 0.5);

  let winnerIndex = 0;
  for (const prize of lottery.prizes) {
    for (let i = 0; i < prize.quantity && winnerIndex < shuffled.length; i++) {
      const winner = shuffled[winnerIndex];
      winner.isWinner = true;
      winner.prizeIndex = lottery.prizes.indexOf(prize);
      winner.prizeName = prize.name;
      winner.prizeValue = prize.value;
      await winner.save();
      winners.push(winner);
      winnerIndex++;
    }
  }

  lottery.status = 'completed';
  lottery.drawnAt = new Date();
  await lottery.save();

  res.json({
    message: '开奖成功',
    winners,
    lottery,
  });
};

// 发送抽奖通知的核心函数（可复用）
const sendLotteryNotifications = async (
  lottery: any,
  bot: any,
  group: any,
  participantCount?: number,
) => {
  console.log('=== 🎲 sendLotteryNotifications 调试信息 ===');
  console.log('📋 抽奖信息:', {
    lotteryId: lottery._id,
    title: lottery.title,
    notifyPin: lottery.notifyPin,
    botName: bot.botName,
    botUserName: bot.userName,
    groupTitle: group.title,
  });

  const telegramBot = setupBot(bot.token);
  const joinUrl = `https://t.me/${bot.userName}?start=join-${lottery.code}`;

  // 用户配置的通知内容模板，替换变量
  let messageContent = lottery.notifyContent || '';
  messageContent = replaceLotteryVariables(messageContent, lottery, {
    joinNum: participantCount !== undefined ? participantCount : 0,
    currentBot: `@${bot.userName}`,
  });

  // 添加参与链接
  const joinLinkText = `\n\n👉 <a href="${joinUrl}">点击参与抽奖</a>`;
  const messageForGroup = messageContent + joinLinkText;

  // 构建按钮键盘
  let keyboard = buildInlineKeyboard(lottery.notifyButtons || []);
  if (!keyboard) {
    keyboard = new InlineKeyboard();
  }
  keyboard.text('🎯 参与抽奖', `lottery_join_${lottery._id}`);

  try {
    console.log(`📨 发送到群组: ${group.title} (${group.id})`);
    await sendLotteryMessage(
      telegramBot,
      group.id,
      messageForGroup,
      keyboard,
      lottery.media,
      lottery.mediaType,
      lottery.notifyPin,
    );
    console.log(`✅ 成功发送到群组: ${group.title}`);
  } catch (err) {
    console.error(`❌ 发送抽奖通知到群组 ${group.title} 失败:`, err);
  }

  console.log('=== 🎲 sendLotteryNotifications 结束 ===\n');
};

// 公开接口：创建抽奖（无需登录，供群管理员使用）
export const createLotteryPublic = async (
  req: RequestCustom,
  res: Response,
) => {
  const { botId, botUserId, ...data } = req.body;

  if (!botId) {
    res.status(400).json({ message: '缺少机器人参数' });
    return;
  }

  if (!data.title) {
    res.status(400).json({ message: '请输入活动标题' });
    return;
  }
  if (!data.group) {
    res.status(400).json({ message: '请选择抽奖群组' });
    return;
  }
  if (!data.drawMethod || data.drawMethod.length === 0) {
    res.status(400).json({ message: '请选择开奖方式' });
    return;
  }
  if (!data.prizes || data.prizes.length === 0) {
    res.status(400).json({ message: '请添加至少一个奖品' });
    return;
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

    // 检查该群组是否已有进行中的抽奖活动
    const existingLottery = await Lottery.findOne({
      bot: botId,
      group: data.group,
      status: 'ongoing',
    });
    if (existingLottery) {
      res.status(400).json({
        message: `该群组已有进行中的抽奖活动："${existingLottery.title}"，请等待其结束后再创建新的抽奖`,
      });
      return;
    }

    const code = generateCode();

    const lotteryData = {
      ...data,
      bot: botId,
      proxy: proxyUser._id,
      code,
      creator: botUserId || null,
      status: 'ongoing',
    };

    const lottery = await Lottery.create(lotteryData);

    // 发送抽奖通知到指定群组
    await sendLotteryNotifications(lottery, bot, group);

    res.status(201).json({
      success: true,
      data: lottery,
      message: '抽奖活动创建成功',
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || '创建失败' });
  }
};

// 公开接口：获取用户创建的抽奖列表（无需登录）
export const getLotteriesByCreator = async (req: Request, res: Response) => {
  const { botUserId } = req.query;

  if (!botUserId) {
    res.status(400).json({ message: '缺少用户参数' });
    return;
  }

  try {
    const lotteries = await Lottery.find({ creator: botUserId })
      .populate('bot', 'botName userName')
      .sort({ createdAt: -1 })
      .limit(20)
      .exec();

    res.json({
      success: true,
      data: lotteries,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || '获取失败' });
  }
};

// 公开接口：获取单个抽奖详情（无需登录）
export const getLotteryPublic = async (req: Request, res: Response) => {
  try {
    const lottery = await Lottery.findById(req.params.id)
      .populate('bot', 'botName userName')
      .exec();

    if (!lottery) {
      res.status(404).json({ message: '抽奖活动不存在' });
      return;
    }

    res.json({
      success: true,
      data: lottery,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || '获取失败' });
  }
};

// 公开接口：获取抽奖参与者列表（无需登录）
export const getLotteryParticipantsPublic = async (
  req: Request,
  res: Response,
) => {
  try {
    const { lotteryId } = req.query;

    if (!lotteryId) {
      res.status(400).json({ message: '缺少抽奖ID参数' });
      return;
    }

    const participants = await LotteryParticipant.find({ lottery: lotteryId })
      .select(
        'telegramId username firstName lastName messageCount joinedAt isWinner prizeIndex prizeName prizeValue',
      )
      .sort({ joinedAt: -1 })
      .exec();

    res.json({
      success: true,
      data: participants,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || '获取失败' });
  }
};

// 公开接口：取消抽奖（无需登录）
export const cancelLotteryPublic = async (req: Request, res: Response) => {
  try {
    const { lotteryId } = req.body;

    if (!lotteryId) {
      res.status(400).json({ message: '缺少抽奖ID参数' });
      return;
    }

    const lottery = await Lottery.findById(lotteryId);
    if (!lottery) {
      res.status(404).json({ message: '抽奖活动不存在' });
      return;
    }

    if (lottery.status === 'completed') {
      res.status(400).json({ message: '已完成的抽奖无法取消' });
      return;
    }

    lottery.status = 'completed';
    await lottery.save();

    res.json({
      success: true,
      message: '抽奖已取消',
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || '取消失败' });
  }
};

// 公开接口：重新发送抽奖通知（无需登录）
export const resendLotteryPublic = async (req: Request, res: Response) => {
  try {
    const { lotteryId } = req.body;

    if (!lotteryId) {
      res.status(400).json({ message: '缺少抽奖ID参数' });
      return;
    }

    const lottery = await Lottery.findById(lotteryId)
      .populate('bot', 'token userName')
      .populate('group', 'id title')
      .exec();

    if (!lottery) {
      res.status(404).json({ message: '抽奖活动不存在' });
      return;
    }

    const bot: any = lottery.bot;
    if (!bot) {
      res.status(404).json({ message: '机器人不存在' });
      return;
    }

    const group: any = lottery.group;
    if (!group) {
      res.status(404).json({ message: '群组不存在' });
      return;
    }

    // 获取当前参与人数
    const participantCount = await LotteryParticipant.countDocuments({
      lottery: lottery._id,
    });

    await sendLotteryNotifications(lottery, bot, group, participantCount);

    res.json({
      success: true,
      message: '抽奖通知已重新发送',
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || '发送失败' });
  }
};

// 公开接口：设置内定中奖（无需登录）
export const setFixedWinnerPublic = async (req: Request, res: Response) => {
  try {
    const { lotteryId, participantId, prizeIndex } = req.body;

    if (!lotteryId || !participantId) {
      res.status(400).json({ message: '缺少必要参数' });
      return;
    }

    const lottery = await Lottery.findById(lotteryId);
    if (!lottery) {
      res.status(404).json({ message: '抽奖活动不存在' });
      return;
    }

    const participant = await LotteryParticipant.findById(participantId);
    if (!participant) {
      res.status(400).json({ message: '参与者不存在' });
      return;
    }

    // 如果 prizeIndex 为 null，表示取消内定
    if (prizeIndex === null || prizeIndex === undefined) {
      participant.prizeIndex = undefined;
      participant.prizeName = undefined;
      participant.prizeValue = undefined;
      await participant.save();

      res.json({
        success: true,
        message: '已取消内定',
      });
      return;
    }

    // 验证 prizeIndex 是否有效
    if (prizeIndex < 0 || prizeIndex >= lottery.prizes.length) {
      res.status(400).json({ message: '无效的奖品索引' });
      return;
    }

    const prize = lottery.prizes[prizeIndex];
    participant.prizeIndex = prizeIndex;
    participant.prizeName = prize.name;
    participant.prizeValue = prize.value;
    await participant.save();

    res.json({
      success: true,
      message: '已设置为内定中奖',
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || '设置失败' });
  }
};
