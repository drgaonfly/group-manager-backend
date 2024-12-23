import { Composer } from 'grammy';
import { MyContext } from '../../types';
import mainKeyboard from '../../menus/inline/exampleInlineMenu';
import BotUser from '../../../models/botUser';
import Bot from '../../../models/bot';

const startCommand = new Composer<MyContext>();

startCommand.command('start', async (ctx) => {
  const token = ctx.api.token;
  const bot = await Bot.findOne({ token });

  if (!bot) return;

  bot.userName = ctx.me?.username || bot.userName;
  bot.botName = ctx.me?.first_name || bot.botName;
  bot.id = ctx.me?.last_name || bot.id;

  await bot.save();
  console.log('Bot信息已更新');

  const userId = ctx.from?.id?.toString(); // 确保转换为字符串
  const userName = ctx.from?.username; // 提供默认值
  const firstName = ctx.from?.first_name; // 提供默认值
  const lastName = ctx.from?.last_name; // 提供默认值
  const botId = ctx.me?.id.toString(); // 确保转换为字符串
  // 移除重复的变量声明

  console.log('form_info', ctx);

  // 检查数据库中是否已存在该用户ID
  const existingUser = await BotUser.findOne({ userId: userId });

  if (existingUser) {
    // 如果用户已存在，更新其信息
    console.log(`用户 ${userId} 已存在，更新用户信息。`);

    // 更新用户信息
    existingUser.userName = userName;
    existingUser.firstName = firstName;
    existingUser.lastName = lastName;

    await existingUser.save();
    console.log(`已更新用户: ${existingUser}`);

    await ctx.reply('您的信息已更新！');
  } else {
    // 如果用户不存在，创建新用户
    const newBotUser = new BotUser({
      userName: userName,
      firstName: firstName,
      lastName: lastName,
      userId: userId,
      // bot: new mongoose.Types.ObjectId(botId),
      bot: botId,
    });

    await newBotUser.save();
    console.log(`已保存新用户: ${newBotUser}`);

    await ctx.reply('您已成功注册！');
  }

  // 回复用户信息
  await ctx.reply(
    `我的账户\nID: ${userId}\n名字: ${userName}\nFirstName: ${firstName}\nLastName: ${lastName}`,
  );

  // 搜索botName根据botId
  const botName: string = ctx.me?.username;

  // 发送长文本消息并附带 Inline Menu
  await ctx.reply(bot.message, {
    reply_markup: mainKeyboard,
  });
});

export default startCommand;
