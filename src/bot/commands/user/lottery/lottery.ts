import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import Lottery from '../../../../models/lottery';
import LotteryParticipant from '../../../../models/lotteryParticipant';
import BotUserConfig from '../../../../models/botUserConfig';
import { convertToTelegramHtml } from '../../../../bot/utils/telegramHtml';
import { formatBeijingDate } from '../../../../utils/formatBeijingDate';
import { replaceLotteryVariables } from '../../../../utils/replaceVariables';
import { checkGroup } from '../../../middlewares/checkGroup';
import {
  getGroupUserRanking,
  getGroupUserRankingList,
} from '../../../../services/rankingService';

export const lotteryCommand = new Composer<MyContext>();

// 检查并执行开奖（满人、定时满足任一即可）
async function checkAndDraw(ctx: MyContext, lottery: any, joinNum: number) {
  const now = new Date();
  let shouldDraw = false;

  if (
    lottery.drawMethod.includes('fullParticipants') &&
    lottery.fullParticipantsCount &&
    joinNum >= lottery.fullParticipantsCount
  ) {
    shouldDraw = true;
  }

  if (
    lottery.drawMethod.includes('scheduledTime') &&
    lottery.scheduledDrawTime &&
    now >= new Date(lottery.scheduledDrawTime)
  ) {
    shouldDraw = true;
  }

  if (shouldDraw) {
    await executeDraw(ctx, lottery);
  }
}

// 执行开奖（机器人本位架构简化逻辑）
async function executeDraw(ctx: MyContext, lottery: any) {
  const participants = await LotteryParticipant.find({
    lottery: lottery._id,
  });

  if (participants.length === 0) return;

  // 机器人本位架构下，所有参与者都有资格中奖（移除了复杂的发言数要求）
  const eligibleParticipants = participants;

  // 处理内定中奖用户和随机中奖用户
  const winners: any[] = [];
  const usedParticipantIds = new Set<string>(); // 已中奖的参与者ID
  const fixedWinners = lottery.fixedWinners || [];

  // 按奖品处理
  for (let prizeIdx = 0; prizeIdx < lottery.prizes.length; prizeIdx++) {
    const prize = lottery.prizes[prizeIdx];
    let remainingQuantity = prize.quantity;

    // 1. 先处理该奖品的内定用户
    const fixedForThisPrize = fixedWinners.filter(
      (fw: any) => fw.prizeIndex === prizeIdx,
    );
    for (const fixed of fixedForThisPrize) {
      if (remainingQuantity <= 0) break;

      // 查找内定用户是否在达标参与者中（通过 botUser._id 匹配）
      const fixedBotUserId =
        fixed.botUser?._id?.toString() || fixed.botUser?.toString();
      const participant = eligibleParticipants.find(
        (p) =>
          p.botUser?.toString() === fixedBotUserId &&
          !usedParticipantIds.has(p._id.toString()),
      );

      if (participant) {
        participant.isWinner = true;
        participant.prizeIndex = prizeIdx;
        participant.prizeName = prize.name;
        participant.prizeValue = prize.value;
        participant.isFixed = true; // 标记为内定
        await participant.save();

        // 给中奖用户加积分
        const botUserConfig = await BotUserConfig.findOne({
          bot: lottery.bot,
          botUser: participant.botUser,
        });
        if (botUserConfig) {
          botUserConfig.usdt_balance =
            (botUserConfig.usdt_balance || 0) + Number(prize.value);
          await botUserConfig.save();
        }

        winners.push({
          ...participant.toObject(),
          prize,
        });
        usedParticipantIds.add(participant._id.toString());
        remainingQuantity--;
      }
    }

    // 2. 剩余名额随机抽取
    if (remainingQuantity > 0) {
      const availableParticipants = eligibleParticipants.filter(
        (p) => !usedParticipantIds.has(p._id.toString()),
      );
      const shuffled = [...availableParticipants].sort(
        () => Math.random() - 0.5,
      );

      for (let i = 0; i < remainingQuantity && i < shuffled.length; i++) {
        const winner = shuffled[i];
        winner.isWinner = true;
        winner.prizeIndex = prizeIdx;
        winner.prizeName = prize.name;
        winner.prizeValue = prize.value;
        await winner.save();

        // 给中奖用户加积分
        const botUserConfig = await BotUserConfig.findOne({
          bot: lottery.bot,
          botUser: winner.botUser,
        });
        if (botUserConfig) {
          botUserConfig.usdt_balance =
            (botUserConfig.usdt_balance || 0) + Number(winner.prizeValue);
          await botUserConfig.save();
        }

        winners.push({
          ...winner.toObject(),
          prize,
        });
        usedParticipantIds.add(winner._id.toString());
      }
    }
  }

  // 更新抽奖状态
  lottery.status = 'completed';
  lottery.drawnAt = new Date();
  await lottery.save();

  // 构建中奖名单
  const winnerList = winners
    .map((w) => {
      const name = w.firstName || w.username || `用户${w.telegramId}`;
      const prizeText = `${w.prize.value}积分`;
      return `🎁 <a href="tg://user?id=${w.telegramId}">${name}</a> - ${w.prize.name}(${prizeText})`;
    })
    .join('\n');

  // 发送开奖通知
  const openTime = formatBeijingDate(new Date());
  const drawResultContent = replaceLotteryVariables(
    lottery.drawResultContent,
    lottery,
    {
      joinNum: participants.length,
      winnerList,
      openTime,
      currentBot: `@${ctx.currentBot.userName}`,
    },
  );

  const drawResultMsg = await ctx.reply(
    convertToTelegramHtml(drawResultContent) ||
      `🎊 【${lottery.title}】开奖啦！\n\n参与人数：${participants.length}人\n\n中奖名单：\n${winnerList}`,
    { parse_mode: 'HTML' },
  );
  // 置顶消息
  if (lottery.drawResultPin && drawResultMsg.message_id) {
    try {
      await ctx.api.pinChatMessage(ctx.chat!.id, drawResultMsg.message_id);
    } catch (e) {
      console.error('置顶开奖通知失败:', e);
    }
  }
}

// 关键词触发抽奖（只在群组中工作）
lotteryCommand.on('message:text', checkGroup, async (ctx, next) => {
  // 如果是命令（以 / 开头），跳过关键词处理，让命令处理器处理
  if (ctx.message.text.startsWith('/')) {
    return next();
  }

  const currentGroup = ctx.currentGroup;
  if (!currentGroup) {
    return next();
  }

  // 检查群组是否属于当前机器人
  const currentBot = ctx.currentBot;

  // 检查机器人是否启用抽奖功能
  if (!currentBot.canLotteryRule) {
    return next();
  }

  // 查找该机器人+群组下的进行中抽奖活动
  const lottery = await Lottery.findOne({
    bot: currentBot._id,
    group: currentGroup._id,
    status: { $in: ['pending', 'ongoing'] },
  });

  if (!lottery) {
    return next();
  }

  const text = ctx.message.text.trim();
  const matched = lottery.keywords.some((k) => text === k);

  console.log(
    `[抽奖] 机器人: ${currentBot.botName}, 群组: ${
      currentGroup.title
    }, 关键词: ${lottery.keywords.join(
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

    // 检查用户是否已参与（机器人本位架构简化了参与条件）
    const existingParticipant = await LotteryParticipant.findOne({
      lottery: lottery._id,
      botUser: botUser._id,
    });

    // 如果已参与，直接返回参与信息
    if (existingParticipant) {
      const notifyContent = replaceLotteryVariables(
        lottery.notifyContent || '您已参与该抽奖活动',
        lottery,
        {
          joinNum: await LotteryParticipant.countDocuments({
            lottery: lottery._id,
          }),
          currentBot: `@${ctx.currentBot.userName}`,
          nickname: [ctx.from?.first_name, ctx.from?.last_name]
            .filter(Boolean)
            .join(' '),
          userId: ctx.from?.id,
          userName: ctx.from?.username ? `@${ctx.from.username}` : '',
        },
      );

      await ctx.reply(convertToTelegramHtml(notifyContent), {
        parse_mode: 'HTML',
      });
      return;
    }

    // 获取参与人数
    const joinNum = await LotteryParticipant.countDocuments({
      lottery: lottery._id,
    });

    // 构建开奖条件
    const openConditions: string[] = [];
    if (lottery.drawMethod.includes('fullParticipants')) {
      openConditions.push(`满${lottery.fullParticipantsCount}人开奖`);
    }
    if (
      lottery.drawMethod.includes('scheduledTime') &&
      lottery.scheduledDrawTime
    ) {
      openConditions.push(`${formatBeijingDate(lottery.scheduledDrawTime)}`);
    }

    // 替换变量的辅助函数
    const replaceVariables = async (content: string) => {
      const userBalanceRanking = await getGroupUserRanking(
        ctx.currentBot._id,
        ctx.currentBotUserConfig?.usdt_balance || 0,
        ctx.currentGroup?.botUsers as any,
      );

      const rankingListData = await getGroupUserRankingList(
        ctx,
        ctx.currentBot._id,
        ctx.currentGroup?.botUsers as any,
      );
      const userBalanceRankingList = rankingListData.text;

      return replaceLotteryVariables(content, lottery, {
        joinNum,
        currentBot: `@${ctx.currentBot.userName}`,
        nickname: [ctx.from?.first_name, ctx.from?.last_name]
          .filter(Boolean)
          .join(' '),
        userId: ctx.from?.id,
        userName: ctx.from?.username ? `@${ctx.from.username}` : '',
        userBalanceRanking,
        userBalanceRankingList,
      } as any);
    };

    // 创建参与记录
    await LotteryParticipant.create({
      lottery: lottery._id,
      botUser: botUser._id,
      telegramId: ctx.from?.id,
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name,
      messageCount: 0, // 机器人本位架构简化，不再统计发言数
    });

    // 发送成功参与通知
    const joinSuccessContent = await replaceVariables(
      lottery.joinSuccessContent,
    );
    const joinSuccessMsg = await ctx.reply(
      convertToTelegramHtml(joinSuccessContent) || '🎉 恭喜您成功参与抽奖！',
      { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
    );

    // 置顶消息
    if (lottery.joinSuccessPin && joinSuccessMsg.message_id) {
      try {
        await ctx.api.pinChatMessage(ctx.chat!.id, joinSuccessMsg.message_id);
      } catch (e) {
        console.error('置顶成功参与通知失败:', e);
      }
    }

    // 检查是否满足开奖条件
    const newJoinNum = joinNum + 1;
    await checkAndDraw(ctx, lottery, newJoinNum);
  } catch (error) {
    console.error('抽奖处理失败:', error);
  }
});
