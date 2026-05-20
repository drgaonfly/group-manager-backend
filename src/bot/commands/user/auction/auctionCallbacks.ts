import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import Auction from '../../../../models/auction';
import createDebug from 'debug';

const log = createDebug('bot:auction');

const auctionCallbacksComposer = new Composer<MyContext>();

auctionCallbacksComposer.callbackQuery(/^auction_join_(.+)$/, async (ctx) => {
  const auctionId = ctx.match[1];
  log(`用户点击了竞拍参与按钮，竞拍ID: ${auctionId}`);

  try {
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      await ctx.answerCallbackQuery({
        text: '❌ 竞拍活动不存在',
        show_alert: true,
      });
      return;
    }

    if (auction.status !== 'ongoing') {
      await ctx.answerCallbackQuery({
        text: '❌ 竞拍活动已结束',
        show_alert: true,
      });
      return;
    }

    if (new Date() >= new Date(auction.endTime)) {
      await ctx.answerCallbackQuery({
        text: '❌ 竞拍活动已过期',
        show_alert: true,
      });
      return;
    }

    let currentHighest = auction.startingPrice;
    let minimumBid = auction.startingPrice + auction.minBidIncrement;

    if (auction.bids && auction.bids.length > 0) {
      currentHighest = Math.max(...auction.bids.map((b: any) => b.bidAmount));
      minimumBid = currentHighest + auction.minBidIncrement;
    }

    const keywords = auction.keywords.join(' 或 ');
    const endTime = new Date(auction.endTime).toLocaleString('zh-CN');

    const participateMessage =
      `🏆 竞拍参与方法：\n\n` +
      `📝 在群组中发送关键词：\n` +
      `💬 ${keywords}\n\n` +
      `💰 当前最高价：${currentHighest}积分\n` +
      `📈 最低出价：${minimumBid}积分\n` +
      `📊 加价区间：${auction.minBidIncrement}-${auction.maxBidIncrement}积分\n` +
      `⏰ 结束时间：${endTime}\n\n` +
      `💡 出价方式：\n` +
      `1. 先发送关键词参与\n` +
      `2. 回复机器人消息并输入出价金额`;

    await ctx.answerCallbackQuery({
      text: participateMessage,
      show_alert: true,
    });
  } catch (error) {
    log('处理竞拍参与按钮失败:', error);
    await ctx.answerCallbackQuery({
      text: '❌ 处理失败，请稍后重试',
      show_alert: true,
    });
  }
});

export default auctionCallbacksComposer;
