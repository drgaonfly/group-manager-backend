import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import { startClientAndGetSession } from '../../../services/gramClient';
import mainKeyboard from '../../../menus/keyboards/mainKeyboard';
import { checkBillPermission } from '../../../../bot/middlewares/checkBillPermission';

const startCommand = new Composer<MyContext>();

const debug = createDebug('bot:start');

// 开始命令处理
startCommand.command('start', checkBillPermission, async (ctx) => {
  debug('start');
  const chatId = ctx.chat.id; // 获取群组 ID
  const bot = ctx.currentBot;

  const botSession = bot.session;

  debug('------------------session------------------');
  if (!botSession) {
    const session = await startClientAndGetSession(bot.token);
    debug('session', session);
    bot.session = session as any;
    await bot.save();
  }

  debug(ctx.chat);

  // 判断是否在群组中
  if (ctx.chat.type !== 'private') {
    await ctx.reply('感谢您把我添加到贵群!\n下一步设置费率，请发：设置费率x%');
    debug(`感谢添加！本群 ID 为：${chatId}`);

    // 检查机器人是否可以读取所有群组消息
    if (!ctx.me.can_read_all_group_messages) {
      await ctx.reply(
        '请关闭机器人隐私模式，否则无法正常工作。\n设置方法：联系 @BotFather，发送 /setprivacy，选择机器人，选择 Disable',
      );
      debug('需要关闭机器人隐私模式');
    }

    return;
  }

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
  await ctx.reply('欢迎使用机器人', {
    reply_markup: combinedKeyboard,
  });

  await ctx.reply(bot.message || '欢迎使用机器人', {
    reply_markup: mainKeyboard,
  });
});

export default startCommand;
