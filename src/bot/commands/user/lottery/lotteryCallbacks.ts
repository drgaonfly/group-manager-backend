import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import Lottery from '../../../../models/lottery';
import createDebug from 'debug';

const log = createDebug('bot:lottery');

const lotteryCallbacksComposer = new Composer<MyContext>();

lotteryCallbacksComposer.callbackQuery(/^lottery_join_(.+)$/, async (ctx) => {
  const lotteryId = ctx.match[1];
  log(`用户点击了抽奖参与按钮，抽奖ID: ${lotteryId}`);

  try {
    const lottery = await Lottery.findById(lotteryId);
    if (!lottery) {
      await ctx.answerCallbackQuery({
        text: '❌ 抽奖活动不存在',
        show_alert: true,
      });
      return;
    }

    if (lottery.status !== 'ongoing') {
      await ctx.answerCallbackQuery({
        text: '❌ 抽奖活动已结束',
        show_alert: true,
      });
      return;
    }

    const keywords = lottery.keywords.join(' 或 ');
    const participateMessage =
      `🎯 参与抽奖方法：\n\n` +
      `📝 在群组中发送以下关键词之一：\n` +
      `💬 ${keywords}\n\n` +
      `🎁 奖品：\n${lottery.prizes
        .map(
          (p: any, i: number) =>
            `${i + 1}. ${p.name} - ${p.value}积分 x${p.quantity}份`,
        )
        .join('\n')}\n\n` +
      `⏰ 开奖条件：\n${
        lottery.drawMethod.includes('fullParticipants')
          ? `满${lottery.fullParticipantsCount}人开奖`
          : ''
      }${
        lottery.drawMethod.includes('scheduledTime') &&
        lottery.scheduledDrawTime
          ? `\n定时开奖: ${new Date(lottery.scheduledDrawTime).toLocaleString(
              'zh-CN',
            )}`
          : ''
      }`;

    await ctx.answerCallbackQuery({
      text: participateMessage,
      show_alert: true,
    });
  } catch (error) {
    log('处理抽奖参与按钮失败:', error);
    await ctx.answerCallbackQuery({
      text: '❌ 处理失败，请稍后重试',
      show_alert: true,
    });
  }
});

export default lotteryCallbacksComposer;
