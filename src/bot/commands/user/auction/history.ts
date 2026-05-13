import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { checkInBot } from '../../../middlewares/checkInBot';
import Auction from '../../../../models/auction';
import { formatBeijingDate } from '../../../../utils/formatBeijingDate';

export const auctionHistoryCommand = new Composer<MyContext>();

// 显示用户创建的竞拍列表
auctionHistoryCommand.command('myauction', checkInBot, async (ctx) => {
  const botUser = ctx.currentBotUser;

  if (!botUser) {
    await ctx.reply('❌ 无法获取用户信息');
    return;
  }

  // 查询用户在当前机器人下创建的竞拍
  const auctions = await Auction.find({
    bot: ctx.currentBot._id,
    creator: botUser._id,
  })
    .populate('group', 'title username')
    .sort({ createdAt: -1 })
    .limit(10)
    .exec();

  if (auctions.length === 0) {
    await ctx.reply('📭 您还没有在当前机器人下创建过竞拍活动');
    return;
  }

  const statusMap: Record<string, string> = {
    pending: '⏳ 待开始',
    ongoing: '🏆 进行中',
    completed: '✅ 已完成',
  };

  let message = `🏆 <b>我的竞拍活动</b>\n\n`;

  for (const auction of auctions) {
    const group = auction.group as any;
    const groupName = group?.title || '未知群组';
    const status = statusMap[auction.status] || auction.status;
    const createdAt = formatBeijingDate(auction.createdAt);
    const endTime = formatBeijingDate(auction.endTime);

    // 获取当前最高出价
    let currentHighest = auction.startingPrice;
    if (auction.bids && auction.bids.length > 0) {
      currentHighest = Math.max(...auction.bids.map((b) => b.bidAmount));
    }

    message += `📌 <b>${auction.title}</b>\n`;
    message += `   群组：${groupName}\n`;
    message += `   状态：${status}\n`;
    message += `   起拍价：${auction.startingPrice}积分\n`;
    message += `   当前最高价：${currentHighest}积分\n`;
    message += `   出价次数：${auction.bids?.length || 0}\n`;
    message += `   结束时间：${endTime}\n`;
    message += `   创建时间：${createdAt}\n\n`;
  }

  await ctx.reply(message, { parse_mode: 'HTML' });
});
