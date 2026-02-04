import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { checkInBot } from '../../../middlewares/checkInBot';
import Lottery from '../../../../models/lottery';
import { formatBeijingDate } from '../../../../utils/formatBeijingDate';

export const lotteryHistoryCommand = new Composer<MyContext>();

// 显示用户创建的抽奖列表
lotteryHistoryCommand.command('mylottery', checkInBot, async (ctx) => {
  const botUser = ctx.currentBotUser;

  if (!botUser) {
    await ctx.reply('❌ 无法获取用户信息');
    return;
  }

  // 查询用户在当前机器人下创建的抽奖
  const lotteries = await Lottery.find({
    bot: ctx.currentBot._id,
    creator: botUser._id,
  })
    .populate('groups', 'title username')
    .sort({ createdAt: -1 })
    .limit(10)
    .exec();

  if (lotteries.length === 0) {
    await ctx.reply('📭 您还没有在当前机器人下创建过抽奖活动');
    return;
  }

  const statusMap: Record<string, string> = {
    pending: '⏳ 待开始',
    ongoing: '🎯 进行中',
    completed: '✅ 已完成',
  };

  let message = `🎰 <b>我的抽奖活动</b>\n\n`;

  for (const lottery of lotteries) {
    // 机器人本位架构，所有关联群组都有效
    const groupNames = '所有关联群组';
    const status = statusMap[lottery.status] || lottery.status;
    const createdAt = formatBeijingDate(lottery.createdAt);

    message += `📌 <b>${lottery.title}</b>\n`;
    message += `   范围：${groupNames}\n`;
    message += `   状态：${status}\n`;
    message += `   创建：${createdAt}\n\n`;
  }

  await ctx.reply(message, { parse_mode: 'HTML' });
});
