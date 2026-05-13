import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export const auctionCreateCommand = new Composer<MyContext>();

// 创建竞拍命令 - 支持群组和私聊
auctionCreateCommand.command('newauction', async (ctx) => {
  const botId = ctx.currentBot._id;
  const botUserId = ctx.currentBotUser?._id || '';

  // 检查是否在私聊中
  if (ctx.chat?.type !== 'private') {
    // 在群组中发送命令，提示用户切换到私聊
    const botUsername = ctx.currentBot.userName;
    const privateChatUrl = `https://t.me/${botUsername}`;

    await ctx.reply(
      `🏆 <b>创建竞拍活动</b>\n\n` +
        `请在私聊中使用此命令。\n\n` +
        `👉 <a href="${privateChatUrl}">点击这里切换到私聊</a>\n\n` +
        `然后发送 <code>/newauction</code> 命令创建竞拍活动。`,
      {
        parse_mode: 'HTML',
        reply_to_message_id: ctx.message?.message_id,
      },
    );
    return;
  }

  // 在私聊中，直接跳转到前端页面
  const createUrl = `${FRONTEND_URL}/auction/create?botId=${botId}&botUserId=${botUserId}`;
  const keyboard = new InlineKeyboard().url('🏆 创建竞拍活动', createUrl);

  await ctx.reply(
    `🏆 <b>创建机器人竞拍</b>\n\n` +
      `点击下方按钮进入创建页面，选择群组范围即可创建竞拍活动。`,
    {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    },
  );
});
