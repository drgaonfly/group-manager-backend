import { Composer } from 'grammy';
import { MyContext } from '../../../types';

const keyboardCommand = new Composer<MyContext>();

keyboardCommand.on('message:text', async (ctx, next) => {
  // 获取当前机器人配置的自定义键盘按钮
  const customKeyboards = ctx.currentBot?.keyboards || [];

  // 获取用户点击的文本
  const clickedText = ctx.message.text;

  // 查找是否是自定义键盘按钮（通过 label 或 command 匹配）
  const matchedKeyboard = customKeyboards.find(
    (kb) => kb.label === clickedText || kb.command === clickedText,
  );

  if (matchedKeyboard) {
    try {
      // 发送按钮配置的内容
      await ctx.reply(matchedKeyboard.content, { parse_mode: 'HTML' });
    } catch (error) {
      await ctx.reply('处理请求时发生错误，请稍后重试。');
    }
  } else {
    // 如果不是自定义键盘按钮，让其他处理程序继续处理
    await next();
  }
});

export default keyboardCommand;
