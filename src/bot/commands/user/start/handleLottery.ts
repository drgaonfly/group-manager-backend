import { MyContext } from '../../../types';
import Lottery from '../../../../models/lottery';
import LotteryParticipant from '../../../../models/lotteryParticipant';
import { buildInlineKeyboard } from '../../../utils/buildInlineKeyboard';
import { convertToTelegramHtml } from '../../../utils/telegramHtml';

// 处理抽奖参与
export const handleJoinLottery = async (
  ctx: MyContext,
  code: string,
): Promise<boolean> => {
  const lottery = await Lottery.findOne({ code, status: 'ongoing' })
    .populate('bot', 'botName userName')
    .exec();

  if (!lottery) {
    await ctx.reply('❌ 抽奖活动不存在或已结束');
    return true;
  }

  const botUser = ctx.currentBotUser;
  if (!botUser) {
    await ctx.reply('❌ 无法获取用户信息，请重试');
    return true;
  }

  // 检查是否已参与
  const existing = await LotteryParticipant.findOne({
    lottery: lottery._id,
    botUser: botUser._id,
  });

  if (existing) {
    await ctx.reply('⚠️ 您已经参与过这个抽奖活动了');
    return true;
  }

  // 机器人本位架构简化：跳过复杂的频道和发言数检查
  console.log(`用户参与抽奖: ${lottery.title}, 用户: ${botUser._id}`);

  // 创建参与记录
  await LotteryParticipant.create({
    lottery: lottery._id,
    botUser: botUser._id,
    telegramId: botUser.id,
    username: botUser.userName,
    firstName: botUser.firstName,
    lastName: botUser.lastName,
    messageCount: 0, // 参与时先设为0，开奖时再统计
    joinedAt: new Date(),
  });

  // 获取当前参与人数
  const participantCount = await LotteryParticipant.countDocuments({
    lottery: lottery._id,
  });

  // 构建奖品列表
  const prizeList = lottery.prizes
    .map((p) => {
      const valueText = `${p.value}积分`;
      return `${p.name} x${p.quantity} (${valueText})`;
    })
    .join('\n');

  // 构建开奖条件
  const conditions: string[] = [];
  if (lottery.drawMethod.includes('fullParticipants')) {
    conditions.push(`满${lottery.fullParticipantsCount || 10}人开奖`);
  }
  if (
    lottery.drawMethod.includes('scheduledTime') &&
    lottery.scheduledDrawTime
  ) {
    const drawTime = new Date(lottery.scheduledDrawTime).toLocaleString(
      'zh-CN',
      { timeZone: 'Asia/Shanghai' },
    );
    conditions.push(`定时开奖: ${drawTime}`);
  }

  // 使用 joinSuccessContent 字段，替换变量
  let message = lottery.joinSuccessContent || '';
  if (message) {
    message = message
      .replace(/{lotteryTitle}/g, lottery.title)
      .replace(/{goodsList}/g, prizeList)
      .replace(/{joinCondition}/g, '加入机器人关联群组')
      .replace(/{openCondition}/g, conditions.join('\n'))
      .replace(/{joinNum}/g, String(participantCount));
  }

  // 如果没有配置通知内容，使用默认格式
  if (!message) {
    message =
      `🎉 <b>参与成功！</b>\n\n` +
      `🎟️ 活动：${lottery.title}\n` +
      `👥 当前参与人数：${participantCount}人\n\n` +
      `🎁 奖品：\n${prizeList}\n\n` +
      `祝您好运！`;
  }

  // 构建按钮键盘
  const keyboard = buildInlineKeyboard(lottery.joinSuccessButtons || []);

  // 发送消息（支持媒体）
  if (lottery.media && lottery.mediaType) {
    if (lottery.mediaType === 'image') {
      await ctx.replyWithPhoto(lottery.media, {
        caption: convertToTelegramHtml(message),
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } else if (lottery.mediaType === 'video') {
      await ctx.replyWithVideo(lottery.media, {
        caption: convertToTelegramHtml(message),
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    }
  } else {
    await ctx.reply(convertToTelegramHtml(message), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }

  return true;
};
