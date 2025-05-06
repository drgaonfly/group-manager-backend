import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../types';
import BotUser from '../../../models/botUser';
import Bot, { IMenu } from '../../../models/bot';
import User from '../../../models/user';
import createDebug from 'debug';

const startCommand = new Composer<MyContext>();

const debug = createDebug('bot:error');

startCommand.command('start', async (ctx) => {
  debug('start');
  const token = ctx.api.token;
  const bot = await Bot.findOne({ token, isOnline: true });

  if (!bot) {
    console.log('机器人已离线');
    await ctx.reply('机器人已离线');
    return;
  }

  bot.userName = ctx.me?.username || bot.userName;
  bot.botName = ctx.me?.first_name || bot.botName;
  bot.id = ctx.me?.id || bot.id;

  await bot.save();
  console.log('Bot信息已更新');
  console.log(bot);

  console.log('form_info', ctx.from);

  const id = ctx.from?.id?.toString();
  const userName = ctx.from?.username;
  const firstName = ctx.from?.first_name;
  const lastName = ctx.from?.last_name;

  console.log('form_info', ctx);

  const user = await User.findById(bot.user);

  // 检查数据库中是否已存在该用户ID
  const botUser = await BotUser.findOneAndUpdate(
    { id },
    {
      $set: {
        userName,
        firstName,
        lastName,
        bot: bot._id,
        user: user._id,
      },
    },
    { new: true, upsert: true },
  );

  console.log(`已${botUser.isNew ? '添加' : '更新'}用户: ${botUser}`);

  // 回复用户信息
  // await ctx.reply(
  //   `我的账户\nID: ${userId}\n名字: ${userName}\nFirstName: ${firstName}\nLastName: ${lastName}`,
  // );

  // 发送长文本消息并附带 Inline Menu
  await ctx.reply(bot.message || '欢迎使用机器人', {
    reply_markup: setMenu(bot.menus),
  });
});

const setMenu = (menu: IMenu[]) => {
  const inlineMenu = new InlineKeyboard();

  menu.forEach((item) => {
    inlineMenu.url(item.menuName, item.url).row();
  });

  return inlineMenu;
};

export default startCommand;
