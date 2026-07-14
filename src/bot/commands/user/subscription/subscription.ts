import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { isBotOwner } from '../../../middlewares/checkBotOwner';
import { sendStatusCard } from './helpers';

const subscriptionCallback = new Composer<MyContext>();

subscriptionCallback.callbackQuery(
  'subscription_start',
  isBotOwner,
  async (ctx) => {
    const bot = ctx.currentBot;
    const botUser = ctx.currentBotUser;

    if (!bot || !botUser) {
      await ctx.answerCallbackQuery('❌ 无法获取机器人或用户信息');
      return;
    }

    await ctx.answerCallbackQuery();
    await sendStatusCard(ctx, true);
  },
);

export default subscriptionCallback;
