import { MyContext } from '../types';
import createDebug from 'debug';

const debug = createDebug('bot:checkBotExpired');

/**
 * 检查机器人是否已过期，如果过期则阻止功能使用
 * 订阅相关命令允许通过，以便用户可以续费
 */
export const checkBotExpired = async (
  ctx: MyContext,
  next: () => Promise<void>,
) => {
  const bot = ctx.currentBot;

  if (!bot) {
    return await next();
  }

  // 检查机器人是否已过期
  const now = new Date();
  const isExpired = bot.isExpired || (bot.disabledAt && bot.disabledAt < now);

  if (isExpired) {
    debug('机器人已过期，功能已禁用');

    // 允许订阅相关命令通过，以便用户可以续费
    const isSubscriptionCommand =
      ctx.callbackQuery?.data?.startsWith('subscription_') ||
      ctx.message?.text?.startsWith('/subscription') ||
      ctx.message?.text?.includes('订阅');

    if (isSubscriptionCommand) {
      debug('订阅相关命令，允许通过');
      return await next();
    }

    // 如果是过期状态，返回提示信息
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: '❌ 机器人已过期，请续费后继续使用',
        show_alert: true,
      });
    } else {
      await ctx.reply(
        '❌ 机器人已过期，功能已禁用\n\n' +
          '请通过订阅服务续费以继续使用机器人功能。',
      );
    }
    return;
  }

  await next();
};
