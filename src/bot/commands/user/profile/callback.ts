// src/composers/callback.ts
import { CallbackQueryContext, Composer } from 'grammy';
import createDebug from 'debug';
import { MyContext } from '../../../types';
import charger from '../../../menus/inline/charger';
const debug = createDebug('bot:subscription:callback');

// 创建一个 Composer 实例
const callbackComposer = new Composer<MyContext>();

// 处理“重新选择套餐”按钮点击
callbackComposer.callbackQuery(
  'recharge:select',
  async (ctx: CallbackQueryContext<MyContext>) => {
    debug('recharge:select');
    await ctx.reply('💰请选择下面充值订单金额\n📈请严格按照小数点转账❗️❗️', {
      reply_markup: charger,
    });

    // 可选：确认回调（防止客户端加载动画）
    await ctx.answerCallbackQuery();
  },
);

export default callbackComposer;
