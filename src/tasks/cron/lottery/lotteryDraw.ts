import Lottery from '../../../models/lottery';
import LotteryParticipant from '../../../models/lotteryParticipant';
import BotUserConfig from '../../../models/botUserConfig';
import Group from '../../../models/group';
import { setupBot } from '../../../bot/botSetup';
import { formatBeijingDate } from '../../../utils/formatBeijingDate';
import { convertToTelegramHtml } from '../../../bot/utils/telegramHtml';
import { buildInlineKeyboard } from '../../../bot/utils/buildInlineKeyboard';
import { sendLotteryMessage } from '../../../bot/utils/sendLotteryMessage';
import { replaceLotteryVariables } from '../../../utils/replaceVariables';

export async function checkAndDrawLotteries() {
  const now = new Date();

  // 查找需要开奖的抽奖活动（关联机器人并检查机器人是否启用抽奖）
  const lotteries = await Lottery.find({
    status: { $in: ['pending', 'ongoing'] },
  }).populate('bot');

  // 过滤出机器人启用了抽奖功能的活动
  const activeLotteries = lotteries.filter((lottery) => {
    const bot = lottery.bot as any;
    return bot && bot.canLotteryRule;
  });

  console.log(
    `[抽奖任务] 找到 ${activeLotteries.length} 个进行中的抽奖活动（共 ${lotteries.length} 个）`,
  );

  for (const lottery of activeLotteries) {
    try {
      const participantCount = await LotteryParticipant.countDocuments({
        lottery: lottery._id,
      });

      console.log(
        `[抽奖任务] 抽奖 ${lottery.title} (${
          lottery._id
        }): ${participantCount} 人参与, 开奖方式: ${lottery.drawMethod.join(
          ',',
        )}`,
      );

      let shouldDraw = false;

      // 检查开奖条件
      if (lottery.drawMethod.length === 1) {
        // 单一条件
        if (lottery.drawMethod.includes('fullParticipants')) {
          // 满人开奖：需要达到指定人数
          shouldDraw = participantCount >= (lottery.fullParticipantsCount || 0);
          console.log(
            `[抽奖任务] 满人开奖检查: ${participantCount} >= ${lottery.fullParticipantsCount} = ${shouldDraw}`,
          );
        } else if (lottery.drawMethod.includes('scheduledTime')) {
          // 定时开奖：需要到达指定时间
          shouldDraw =
            lottery.scheduledDrawTime &&
            now >= new Date(lottery.scheduledDrawTime);
          console.log(
            `[抽奖任务] 定时开奖检查: ${now.toISOString()} >= ${
              lottery.scheduledDrawTime
            } = ${shouldDraw}`,
          );
        }
      } else if (lottery.drawMethod.length > 1) {
        // 多条件（需同时满足）
        const fullParticipantsMet =
          !lottery.drawMethod.includes('fullParticipants') ||
          participantCount >= (lottery.fullParticipantsCount || 0);
        const scheduledTimeMet =
          !lottery.drawMethod.includes('scheduledTime') ||
          (lottery.scheduledDrawTime &&
            now >= new Date(lottery.scheduledDrawTime));
        shouldDraw = fullParticipantsMet && scheduledTimeMet;
        console.log(
          `[抽奖任务] 多条件检查: 满人=${fullParticipantsMet}, 定时=${scheduledTimeMet}, 结果=${shouldDraw}`,
        );
      }

      // 只有满足条件且有参与者才开奖
      if (shouldDraw) {
        if (participantCount > 0) {
          console.log(`[抽奖任务] 开始开奖: ${lottery.title}`);
          await executeDraw(lottery);
        } else {
          console.log(
            `[抽奖任务] 抽奖 ${lottery.title} 满足开奖条件但无参与者，跳过`,
          );
        }
      }
    } catch (error) {
      console.error(`抽奖 ${lottery._id} 开奖检查失败:`, error);
    }
  }

  async function executeDraw(lottery: any) {
    const participants = await LotteryParticipant.find({
      lottery: lottery._id,
    });

    if (participants.length === 0) return;

    const bot = lottery.bot as any;
    if (!bot) {
      console.error(`[抽奖任务] 抽奖 ${lottery._id} 没有关联的机器人`);
      return;
    }

    const telegramBot = setupBot(bot.token);

    // 机器人本位架构简化：所有参与者都有资格中奖
    const eligibleParticipants = participants;

    console.log(`[抽奖任务] ${lottery.title}: 参与${participants.length}人`);

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
      },
    );

    const message =
      convertToTelegramHtml(drawResultContent) ||
      `🎊 【${lottery.title}】开奖啦！\n\n参与人数：${participants.length}人\n\n中奖名单：\n${winnerList}`;

    // 构建按钮键盘
    console.log(
      `[抽奖任务] 开奖通知按钮配置:`,
      JSON.stringify(lottery.drawResultButtons, null, 2),
    );
    const keyboard = buildInlineKeyboard(lottery.drawResultButtons || []);
    console.log(`[抽奖任务] 生成的键盘:`, keyboard ? '有按钮' : '无按钮');

    // 获取机器人关联的所有群组（机器人本位架构）
    const targetGroups = await Group.find({ bot: bot._id });

    // 发送到所有关联的群组
    for (const group of targetGroups) {
      try {
        const sentMsg = await sendLotteryMessage(
          telegramBot,
          group.id,
          message,
          keyboard,
          lottery.media,
          lottery.mediaType,
        );

        // 置顶消息
        if (lottery.drawResultPin && sentMsg.message_id) {
          try {
            await telegramBot.api.pinChatMessage(group.id, sentMsg.message_id);
          } catch (e) {
            console.error(
              `抽奖 ${lottery._id} 置顶开奖通知到群组 ${group.title} 失败:`,
              e,
            );
          }
        }
      } catch (error) {
        console.error(
          `抽奖 ${lottery._id} 发送开奖通知到群组 ${group.title} 失败:`,
          error,
        );
      }
    }

    console.log(`抽奖 ${lottery._id} 开奖成功，${winners.length} 人中奖`);
  }
}
