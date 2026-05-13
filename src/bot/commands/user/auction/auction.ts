import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import Auction from '../../../../models/auction';
import { formatBeijingDate } from '../../../../utils/formatBeijingDate';
// import { replaceAuctionVariables } from '../../../../utils/replaceVariables';
import { checkGroup } from '../../../middlewares/checkGroup';
import { executeAuctionEnd } from '../../../../controllers/auctionController';

export const auctionCommand = new Composer<MyContext>();

// 处理出价（回复消息）
auctionCommand.on('message:text', checkGroup, async (ctx, next) => {
  // 检查是否是回复消息
  if (!ctx.message.reply_to_message) {
    return next();
  }

  const currentGroup = ctx.currentGroup;
  if (!currentGroup) {
    return next();
  }

  const currentBot = ctx.currentBot;
  if (!currentBot.canAuctionRule) {
    return next();
  }

  // 查找该群组下的进行中竞拍活动
  const auction = await Auction.findOne({
    bot: currentBot._id,
    group: currentGroup._id,
    status: 'ongoing',
    endTime: { $gt: new Date() }, // 还未结束
  });

  if (!auction) {
    return next();
  }

  // 检查回复的消息是否是竞拍相关的消息
  const replyText = ctx.message.reply_to_message.text || '';
  if (!replyText.includes('竞拍') && !replyText.includes('出价记录')) {
    return next();
  }

  const bidText = ctx.message.text.trim();
  const bidAmount = parseInt(bidText);

  // 验证出价格式
  if (isNaN(bidAmount) || bidAmount <= 0) {
    await ctx.reply('❌ 请输入有效的出价金额（纯数字）', {
      reply_to_message_id: ctx.message.message_id,
    });
    return;
  }

  try {
    const botUser = ctx.currentBotUser;
    if (!botUser) {
      return next();
    }

    // 获取用户积分余额
    const userConfig = ctx.currentBotUserConfig;

    const userBalance = userConfig?.usdt_balance || 0;

    // 检查余额是否足够
    if (userBalance < bidAmount) {
      await ctx.reply(
        `❌ 积分余额不足！\n当前余额：${userBalance}积分\n出价金额：${bidAmount}积分`,
        {
          reply_to_message_id: ctx.message.message_id,
        },
      );
      return;
    }

    // 计算最低出价（当前最高价 + 最小加价幅度）
    let minimumBid = auction.startingPrice;
    if (auction.bids.length > 0) {
      const currentHighest = Math.max(...auction.bids.map((b) => b.bidAmount));
      minimumBid = currentHighest + auction.minBidIncrement;
    } else {
      minimumBid = auction.startingPrice + auction.minBidIncrement;
    }

    // 检查出价是否符合最小加价要求
    if (bidAmount < minimumBid) {
      await ctx.reply(
        `❌ 出价过低！\n最低出价：${minimumBid}积分\n您的出价：${bidAmount}积分`,
        {
          reply_to_message_id: ctx.message.message_id,
        },
      );
      return;
    }

    // 检查出价是否超过最大加价限制
    if (auction.bids.length > 0) {
      const currentHighest = Math.max(...auction.bids.map((b) => b.bidAmount));
      const maxAllowedBid = currentHighest + auction.maxBidIncrement;
      if (bidAmount > maxAllowedBid) {
        await ctx.reply(
          `❌ 出价过高！\n当前最高价：${currentHighest}积分\n最大允许出价：${maxAllowedBid}积分\n您的出价：${bidAmount}积分`,
          {
            reply_to_message_id: ctx.message.message_id,
          },
        );
        return;
      }
    }

    // 检查用户是否已经是最高出价者
    if (auction.bids.length > 0) {
      const currentHighestBid = auction.bids.reduce((highest, current) =>
        current.bidAmount > highest.bidAmount ? current : highest,
      );

      if (currentHighestBid.botUser.toString() === botUser._id.toString()) {
        await ctx.reply(
          `❌ 您已经是当前最高出价者！\n当前最高价：${currentHighestBid.bidAmount}积分`,
          {
            reply_to_message_id: ctx.message.message_id,
          },
        );
        return;
      }
    }

    // 将之前的出价标记为非获胜状态
    auction.bids.forEach((bid) => {
      bid.isWinning = false;
    });

    // 添加新的出价记录
    const newBid = {
      botUser: botUser._id,
      telegramId: ctx.from?.id || 0,
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name,
      bidAmount,
      bidTime: new Date(),
      isWinning: true,
    };

    auction.bids.push(newBid);
    await auction.save();

    // 构建出价记录列表（分页显示）
    const sortedBids = auction.bids
      .sort(
        (a, b) => new Date(b.bidTime).getTime() - new Date(a.bidTime).getTime(),
      )
      .slice(0, 10); // 只显示最近10条

    const bidRecords = sortedBids
      .map((bid, _index) => {
        const name = bid.firstName || bid.username || `用户${bid.telegramId}`;
        const status = bid.isWinning ? '领先' : '出局';
        const statusIcon = bid.isWinning ? '💗' : '';
        const time = formatBeijingDate(bid.bidTime);

        return `${bid.bidAmount}积分 - ${status} ${statusIcon}${name} ${time}`;
      })
      .join('\n');

    const responseMessage =
      `🎉 您参与的是：${auction.title} 竞拍活动\n\n` +
      `💡 参与方式：直接用您的出价回复本消息！\n\n` +
      `竞拍详情见置顶\n\n` +
      `出价记录（${auction.bids.length}）：\n${bidRecords}`;

    const sentMessage = await ctx.reply(responseMessage, {
      reply_to_message_id: ctx.message.message_id,
      parse_mode: 'HTML',
    });

    // 检查是否需要置顶
    if (auction.isPinned && sentMessage.message_id) {
      try {
        await ctx.api.pinChatMessage(ctx.chat!.id, sentMessage.message_id);
      } catch (e) {
        console.error('置顶出价记录失败:', e);
      }
    }

    // 检查竞拍是否结束
    if (new Date() >= auction.endTime) {
      // 确保 populate bot 和 group
      await auction.populate('bot', 'token userName botName');
      await auction.populate('group', 'id title');
      await executeAuctionEnd(auction);
    }
  } catch (error) {
    console.error('竞拍出价处理失败:', error);
    await ctx.reply('❌ 出价失败，请稍后重试', {
      reply_to_message_id: ctx.message.message_id,
    });
  }
});

// 关键词触发竞拍参与（只在群组中工作）
auctionCommand.on('message:text', checkGroup, async (ctx, next) => {
  // 如果是命令（以 / 开头），跳过关键词处理
  if (ctx.message.text.startsWith('/')) {
    return next();
  }

  const currentGroup = ctx.currentGroup;
  if (!currentGroup) {
    return next();
  }

  const currentBot = ctx.currentBot;
  if (!currentBot.canAuctionRule) {
    return next();
  }

  // 查找该群组下的进行中竞拍活动
  const auction = await Auction.findOne({
    bot: currentBot._id,
    group: currentGroup._id,
    status: 'ongoing',
    endTime: { $gt: new Date() }, // 还未结束
  });

  if (!auction) {
    return next();
  }

  const text = ctx.message.text.trim();
  const matched = auction.keywords.some((k) => text === k);

  console.log(
    `[竞拍] 机器人: ${currentBot.botName}, 群组: ${
      currentGroup.title
    }, 关键词: ${auction.keywords.join(
      ',',
    )}, 用户输入: ${text}, 匹配: ${matched}`,
  );

  if (!matched) {
    return next();
  }

  try {
    const botUser = ctx.currentBotUser;
    if (!botUser) {
      return next();
    }

    // 获取当前最高出价
    let currentHighestBid = auction.startingPrice;
    let minimumBid = auction.startingPrice + auction.minBidIncrement;

    if (auction.bids.length > 0) {
      currentHighestBid = Math.max(...auction.bids.map((b) => b.bidAmount));
      minimumBid = currentHighestBid + auction.minBidIncrement;
    }

    // 构建出价记录列表（分页显示）
    const sortedBids = auction.bids
      .sort(
        (a, b) => new Date(b.bidTime).getTime() - new Date(a.bidTime).getTime(),
      )
      .slice(0, 5); // 只显示最近5条

    let bidRecords = '';
    if (sortedBids.length > 0) {
      bidRecords = sortedBids
        .map((bid, _index) => {
          const name = bid.firstName || bid.username || `用户${bid.telegramId}`;
          const status = bid.isWinning ? '领先' : '出局';
          const statusIcon = bid.isWinning ? '💗' : '';
          const time = formatBeijingDate(bid.bidTime);

          return `${bid.bidAmount}积分 - ${status} ${statusIcon}${name} ${time}`;
        })
        .join('\n');
    } else {
      bidRecords = '暂无出价记录';
    }

    const endTime = formatBeijingDate(auction.endTime);

    const responseMessage =
      `🎉 您参与的是：${auction.title} 竞拍活动\n\n` +
      `💡 参与方式：直接用您的出价回复本消息！\n\n` +
      `💰 当前最高价：${currentHighestBid}积分\n` +
      `📈 加价区间：${auction.minBidIncrement}-${auction.maxBidIncrement}积分\n` +
      `📊 最低出价：${minimumBid}积分\n` +
      `⏰ 结束时间：${endTime}\n\n` +
      `出价记录（${auction.bids.length}）：\n${bidRecords}`;

    await ctx.reply(responseMessage, {
      reply_to_message_id: ctx.message.message_id,
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.error('竞拍参与处理失败:', error);
  }
});
