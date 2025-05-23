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

  debug('ctx.callbackQuery', ctx.callbackQuery);
  debug('ctx.chat', ctx.chat);
  debug(
    'ctx.callbackQuery.message?.message_id',
    ctx.callbackQuery?.message?.message_id,
  );

  // 如果是回调查询，优先尝试 editMessageText
  if (ctx.callbackQuery && ctx.chat && ctx.callbackQuery?.message?.message_id) {
    debug('editMessageText');
    try {
      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: renewal,
      });
      return;
    } catch (err: any) {
      // 如果消息已被编辑或无法编辑，回退为发送新消息
      if (
        err?.description &&
        (err.description.includes('MESSAGE_NOT_MODIFIED') ||
          err.description.includes('message is not modified'))
      ) {
        // 忽略
      } else {
        // 其他错误，打印日志
        debug('editMessageText error:', err);
      }
    }
  }

  // 普通消息或 editMessageText 失败时，直接 reply
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

export default renewalCommand;
