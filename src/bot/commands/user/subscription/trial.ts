import { Composer } from 'grammy';
import { MyContext } from '../../../types';
// import { useTrial } from '../../../../utils/useEjsMessage';
import Subscription, {
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../../../models/subscription';
import createDebug from 'debug';
import { checkInBot } from '../../../../bot/middlewares/checkInBot';

const trialCommand = new Composer<MyContext>();
const debug = createDebug('bot:trial');

// 监听"试用"文本消息
trialCommand.hears('申请试用', checkInBot, async (ctx) => {
  debug('试用命令被触发');

  try {
    // 判断当前用户是不是有一个有效的订阅
    const isEffect = await Subscription.findOne({
      botUser: ctx.currentBotUser,
      status: SubscriptionStatus.Active,
    });

    if (isEffect) {
      await ctx.answerCallbackQuery(
        `您已经有权限了, 结束时间: ${isEffect.expiredAt}`,
      );
      return;
    }

    // 没有订阅的用户就可以试用
    // 创建订阅记录
    // 7天试用期
    const duration = 7 * 24 * 60 * 60 * 1000;

    const subscription = new Subscription({
      botUser: ctx.currentBotUser, // 假设 botUser 是 Telegram 用户 ID
      plan: SubscriptionPlan.Weekly,
      status: SubscriptionStatus.Active,
      isTrial: true,
      createdAt: new Date(),
      expiredAt: new Date(Date.now() + duration),
    });

    await subscription.save();

    // 更新 BotUser 记录
    await ctx.currentBotUser.updateOne({
      currentPlan: subscription,
    });

    await ctx.currentBotUser.save();

    await ctx.answerCallbackQuery(
      `您已经有权限了, 结束时间: ${subscription.expiredAt}`,
    );

    // const renderTrial = useTrial();
    const message = '';

    // 直接回复试用链接
    await ctx.reply(message, {
      parse_mode: 'HTML',
    });
  } catch (error) {
    debug('试用出错:', error);
    await ctx.reply('获取试用信息时出错，请稍后再试。');
  }
});

export default trialCommand;
