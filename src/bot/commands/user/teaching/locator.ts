import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import { checkInBot } from '../../../middlewares/checkInBot';
import { checkTeaching } from '../../../middlewares/checkTeaching';

const locatorComposer = new Composer<MyContext>();

// 触发「更新位置」，展示两种方式供用户选择
locatorComposer.hears(/更新位置/, checkInBot, checkTeaching, async (ctx) => {
  await ctx.conversation.exitAll();

  const keyboard = new InlineKeyboard()
    .text('📍 发送位置', 'loc_method:upload')
    .row()
    .text('⌨️ 输入地址', 'loc_method:input')
    .row()
    .text('❌ 取消', 'close');

  await ctx.reply('请选择更新位置的方式：', { reply_markup: keyboard });
});

export default locatorComposer;
