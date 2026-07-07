import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { sendStatusCard } from './helpers';

const refreshCallback = new Composer<MyContext>();

refreshCallback.callbackQuery('subscription_refresh', async (ctx) => {
  await ctx.answerCallbackQuery();
  await sendStatusCard(ctx, true);
});

export default refreshCallback;
