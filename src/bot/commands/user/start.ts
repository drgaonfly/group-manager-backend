import { Composer } from 'grammy';
import { MyContext } from '../../types';
import mainKeyboard from '../../menus/inline/mainKeyboard';

const startCommand = new Composer<MyContext>();

startCommand.command('start', async (ctx) => {
  // 定义要发送的长文本内容
  const longMessage = `
If your Telegram account is currently in an abnormal state, please click to remove the abnormal status restriction, and your account will return to normal in the next period of time.
如果您的电报账号目前存在异常状态，请点击解除异常状态限制，您的账号会在接下来一段时间内恢复正常。

If your Telegram account is currently restricted from two-way conversations, please click to remove the two-way conversation restrictions. Your account will return to normal within a period of time.
如果您的电报账号目前被限制双向对话，请点击解除双向对话限制，您的账号会在接下来一段时间内恢复正常，
  `;

  // 发送长文本消息并附带 Inline Menu
  await ctx.reply(longMessage, {
    reply_markup: mainKeyboard,
  });
});

export default startCommand;
