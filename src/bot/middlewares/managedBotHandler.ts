import { MyContext } from '../types';
import Bot from '../../models/bot';
import { createBotWithUser } from '../../utils/createBotWithUser';
import { formatBeijingDate } from '../../utils/formatBeijingDate';
import createDebug from 'debug';

const debug = createDebug('bot:managedBotHandler');

/**
 * 处理 managed_bot update
 * 当用户通过 Telegram 的 managed bot 功能创建机器人时，我们会收到这个 update
 * 然后获取 token 并创建机器人实例
 */
async function handleManagedBot(ctx: MyContext) {
  let userId: number;
  try {
    // @ts-ignore - managed_bot is a new update type (grammy 1.45.1+), TS cache may need refresh
    const managedBot = ctx.update.managed_bot;
    if (!managedBot) {
      debug('[handleManagedBot] No managed_bot data in update');
      return;
    }

    const botId = managedBot.bot.id;
    const botUser = managedBot.user;
    userId = botUser.id;

    debug('[handleManagedBot] Received managed_bot update:', {
      botId,
      botUsername: botUser.username,
      firstName: botUser.first_name,
      userId,
    });

    // 检查是否已经创建过这个机器人
    const existingBot = await Bot.findOne({ id: String(botId) });
    if (existingBot) {
      debug('[handleManagedBot] Bot already exists:', existingBot._id);
      return;
    }

    // 获取 managed bot 的 token
    debug('[handleManagedBot] Getting token for managed bot:', botId);
    let token: string;
    try {
      // @ts-ignore - getManagedBotToken is a new API method (grammy 1.45.1+), TS cache may need refresh
      token = await ctx.api.getManagedBotToken(botId);
      debug('[handleManagedBot] Token received successfully');
    } catch (e: any) {
      debug('[handleManagedBot] Failed to get token:', e.message);
      await ctx.api.sendMessage(userId, '❌ 获取机器人 token 失败，请稍后重试');
      return;
    }

    // 获取当前机器人的信息（作为 manager bot）
    const currentBot = ctx.currentBot;
    if (!currentBot) {
      debug('[handleManagedBot] No current bot found');
      return;
    }

    // 获取当前用户（创建者）的 BotUser 信息
    const currentBotUser = ctx.currentBotUser;
    if (!currentBotUser) {
      debug('[handleManagedBot] No current bot user found');
      return;
    }

    debug(
      '[handleManagedBot] Creating bot with token:',
      token.slice(0, 10) + '...',
    );

    // 调用 createBotWithUser 创建机器人实例
    const result = await createBotWithUser(token, currentBot, currentBotUser);

    if (result.success) {
      const { loginUrl, userName, disabledAt } = result.account!;

      await ctx.api.sendMessage(
        userId,
        [
          '✅ <b>机器人创建成功！</b>',
          '',
          `您的专属机器人已创建完成。`,
          '',
          '请点击下方用户名打开您的机器人，并添加至群组设置为管理员。',
          '',
          `您的机器人：@${userName}`,
          '',
          `有效期：${formatBeijingDate(disabledAt)}`,
          '',
          `🌐 <a href="${loginUrl}">🖥️ 登录管理后台</a>`,
          '',
          '🤖 机器人正在初始化，稍后即可正常使用。',
        ].join('\n'),
        { parse_mode: 'HTML' },
      );

      debug('[handleManagedBot] Bot created successfully:', userName);
    } else {
      await ctx.api.sendMessage(
        userId,
        `❌ 机器人创建失败：${result.message || '请稍后再试'}`,
      );
      debug('[handleManagedBot] Bot creation failed:', result.message);
    }
  } catch (e: any) {
    debug('[handleManagedBot] Error:', e.message);
    if (userId) {
      await ctx.api.sendMessage(userId, '❌ 处理机器人创建时发生错误');
    }
  }
}

export default handleManagedBot;
