import { Composer } from 'grammy';
import { MyContext } from '../../types';
import Bot from '../../../../../../Telebot-Spam/spam-bot-backend/src/models/bot';

const changeMessageCommand = new Composer<MyContext>();

// 用于存储用户的输入状态
const userStates: Record<number, boolean> = {};

changeMessageCommand.command('changeMessage', async (ctx) => {
  const userId = ctx.from?.id;

  if (!userId) {
    await ctx.reply('无法识别用户信息，请重试。');
    return;
  }

  // 设置用户状态为等待输入
  userStates[userId] = true;

  // 提示用户输入新的消息
  await ctx.reply('请输入新的消息:');
});

// 监听用户发送的文本消息
changeMessageCommand.on('message:text', async (ctx) => {
  const userId = ctx.from?.id;

  if (!userId || !userStates[userId]) {
    // 如果用户没有处于输入状态，忽略消息
    return;
  }

  // 获取用户输入的新消息
  const longMessage = ctx.message.text;

  try {
    // 根据当前机器人的 botName 搜索
    const botName = ctx.me?.username;

    if (!botName) {
      await ctx.reply('无法获取机器人名称，请稍后重试。');
      delete userStates[userId];
      return;
    }

    // 搜索对应的 Bot 数据并更新消息
    const bot = await Bot.findOne({ botName: botName });
    if (bot) {
      bot.message = longMessage; // 更新 message 字段
      await bot.save(); // 保存到数据库
      console.log(`已更新Bot: ${botName} 的消息为: ${longMessage}`);

      // 确认消息已更新
      await ctx.reply(`消息已成功更新为：\n${longMessage}`);
    } else {
      console.log(`未找到名为 ${botName} 的Bot`);
      await ctx.reply(`未找到名为 ${botName} 的机器人记录，请检查数据库。`);
    }
  } catch (error) {
    console.error('更新消息时出错:', error);
    await ctx.reply('更新消息时发生错误，请稍后再试。');
  } finally {
    // 无论成功或失败，都清理用户状态
    delete userStates[userId];
  }
});

export default changeMessageCommand;
