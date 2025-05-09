import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../types';
import { IMenu } from '../../../models/bot';
import createDebug from 'debug';

const startCommand = new Composer<MyContext>();

const debug = createDebug('bot:error');

// const setMenu = (menu: IMenu[]) => {
//   const inlineMenu = new InlineKeyboard();

//   menu.forEach((item) => {
//     inlineMenu.url(item.menuName, item.url).row();
//   });

//   return inlineMenu;
// };

// 开始命令处理
startCommand.command('start', async (ctx) => {
  debug('start');

  // 判断是否在群组中
  if (ctx.chat.type !== 'private') {
    await ctx.reply('感谢您把我添加到贵群!\n下一步设置费率，请发：设置费率x%');
    return;
  }

  const bot = ctx.currentBot;

  // 合并原有菜单和添加到群组按钮
  const combinedKeyboard = new InlineKeyboard();

  // 添加群组按钮
  combinedKeyboard
    .url('➕ 添加到群聊', `https://t.me/${ctx.me.username}?startgroup=true`)
    .row();

  // 添加原有菜单项
  bot.menus.forEach((item) => {
    combinedKeyboard.url(item.menuName, item.url).row();
  });

  // 发送消息和组合后的按钮
  await ctx.reply(bot.message || '欢迎使用机器人', {
    reply_markup: combinedKeyboard,
  });
});

export default startCommand;
