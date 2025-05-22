import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import renewal from '../../../menus/inline/renewal';
import { useRenewal } from '../../../../utils/useEjsMessage';
import createDebug from 'debug';
import { checkInBot } from '../../../../bot/middlewares/checkInBot';
// import Subscription, {
//   SubscriptionPlan,
//   SubscriptionStatus,
// } from '../../../../models/subscription';

const renewalCommand = new Composer<MyContext>();
const debug = createDebug('bot:renewal');

// 处理续费消息的函数
export const handleRenewalMessage = async (ctx: MyContext) => {
  const renderRenewal = useRenewal();
  const message = await renderRenewal();
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: renewal,
  });
};

// 监听"自助续费"文本消息
renewalCommand.hears(/自助续费/, checkInBot, async (ctx) => {
  debug('续费命令被触发');
  await handleRenewalMessage(ctx);
});

// 处理回调查询
// renewalCommand.on('callback_query:data', async (ctx) => {
//   debug('回调查询被触发');
//   const data = ctx.callbackQuery?.data;
//   if (data && data.startsWith('subscribe:')) {
//     const plan = data.split(':')[1] as SubscriptionPlan;
//     let duration;
//     switch (plan) {
//       case 'biweekly':
//         duration = 15 * 24 * 60 * 60 * 1000; // 半个月
//         break;
//       case 'monthly':
//         duration = 30 * 24 * 60 * 60 * 1000; // 一个月
//         break;
//       case 'quarterly':
//         duration = 90 * 24 * 60 * 60 * 1000; // 三个月
//         break;
//       default:
//         duration = 0;
//     }
//     try {
//       // 判断当前用户是否已经有一个有效的订阅
//       const isEffect = await Subscription.findOne({
//         botUser: ctx.currentBotUser,
//         status: SubscriptionStatus.Active,
//       });

//       if (isEffect) {
//         await ctx.answerCallbackQuery(
//           `您已经有权限了, 结束时间: ${isEffect.expiredAt}`,
//         );
//         return;
//       }

//       // 创建订阅记录
//       const subscription = new Subscription({
//         botUser: ctx.currentBotUser, // 假设 botUser 是 Telegram 用户 ID
//         plan,
//         status: SubscriptionStatus.Active,
//         createdAt: new Date(),
//         expiredAt: new Date(Date.now() + duration),
//       });
//       await subscription.save();

//       // 更新 BotUser 记录
//       await ctx.currentBotUser.updateOne({
//         currentPlan: subscription,
//       });

//       await ctx.currentBotUser.save();

//       await ctx.answerCallbackQuery(`已成功订阅 ${plan} 计划`);
//     } catch (error) {
//       debug('创建订阅记录出错:', error);
//       await ctx.answerCallbackQuery('创建订阅记录时出错，请稍后再试。');
//     }
//   }
// });

export default renewalCommand;
