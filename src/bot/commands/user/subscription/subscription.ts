import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { sendStatusCard } from './helpers';

const subscriptionCallback = new Composer<MyContext>();

subscriptionCallback.callbackQuery('subscription_start', async (ctx) => {
  const bot = ctx.currentBot;
  const botUser = ctx.currentBotUser;

  if (!bot || !botUser) {
    await ctx.answerCallbackQuery('❌ 无法获取机器人或用户信息');
    return;
  }

  // 检查是否是 owner
  const ownerIdStr = bot.owner?.toString();
  const currentBotUserIdStr = botUser._id?.toString();
  const isOwner =
    ownerIdStr && currentBotUserIdStr && ownerIdStr === currentBotUserIdStr;

  if (!isOwner) {
    await ctx.answerCallbackQuery('❌ 只有机器人所有者可以使用此功能');
    return;
  }

  await ctx.answerCallbackQuery();
  await sendStatusCard(ctx, true);
});

export default subscriptionCallback;
