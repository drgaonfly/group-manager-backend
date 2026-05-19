import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import { checkSuccess } from '../../../middlewares/checkSuccess';
import createDebug from 'debug';

const debug = createDebug('bot:success');

const successComposer = new Composer<MyContext>();

// 群内发"继承"触发入口消息，带两个深链接按钮跳转私聊
successComposer.hears(/继承/, checkSuccess, async (ctx) => {
  debug('积分继承触发');
  const botUserName = ctx.me.username;

  const keyboard = new InlineKeyboard()
    .url('🔑 我的继承码', `https://t.me/${botUserName}?start=mycode`)
    .url('💸 立即继承', `https://t.me/${botUserName}?start=inherit`);

  await ctx.reply('💎 *积分继承*\n\n请选择操作：', {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
});

export default successComposer;
