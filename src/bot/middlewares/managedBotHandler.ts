import { MyContext } from '../types';
import Bot from '../../models/bot';
import BotUser from '../../models/botUser';
import { createBotWithUser } from '../../utils/createBotWithUser';
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
    const telegramUser = managedBot.user;
    userId = telegramUser.id;

    debug('[handleManagedBot] Received managed_bot update:', {
      botId,
      botUsername: telegramUser.username,
      firstName: telegramUser.first_name,
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

    // 使用 managedBot.user（创建者）来查找或创建 BotUser
    // BotUser 是与特定 bot 关联的，需要同时匹配 id 和 bot
    let botUser = await BotUser.findOne({
      id: userId.toString(),
      bot: currentBot._id,
    });
    if (!botUser) {
      // 如果 BotUser 不存在，创建一个新的并关联到当前 bot
      botUser = new BotUser({
        id: userId.toString(),
        bot: currentBot._id,
        userName: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
      });
      await botUser.save();
      debug('[handleManagedBot] Created new BotUser:', botUser._id);
    }

    debug(
      '[handleManagedBot] Creating bot with token:',
      token.slice(0, 10) + '...',
      'for user:',
      botUser.userName,
    );

    // 调用 createBotWithUser 创建机器人实例
    await createBotWithUser(token, currentBot, botUser);
  } catch (e: any) {
    debug('[handleManagedBot] Error:', e.message);
    if (userId) {
      await ctx.api.sendMessage(userId, '❌ 处理机器人创建时发生错误');
    }
  }
}

export default handleManagedBot;
