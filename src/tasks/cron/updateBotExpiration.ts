import Bot from '../../models/bot';
import { setupBot } from '../../bot/botSetup';
import BotUser from '../../models/botUser';

export const updateBotExpiration = async () => {
  try {
    console.log('[updateBotExpiration] 开始检查过期机器人...');
    const now = new Date();
    console.log(now.toLocaleString('zh-CN', { hour12: false }));

    // Find all bots that have expired and were pre-notified
    const expiredBots = await Bot.find({
      disabledAt: { $exists: true, $lt: now },
      type: 'private',
      preExpirationNotified: true,
    }).populate('owner');

    console.log(
      `[updateBotExpiration] 查询到 ${expiredBots.length} 个已过期的机器人`,
    );

    for (const bot of expiredBots) {
      console.log(`[updateBotExpiration] 正在处理机器人: ${bot.botName}`);

      // 获取机器人实例
      const botInstance = setupBot(bot.token);

      // 通知拥有者
      if (bot.owner) {
        const owner = await BotUser.findById(bot.owner);
        if (owner?.id) {
          try {
            await botInstance.api.sendMessage(
              owner.id,
              `⚠️ 机器人 <b>${bot.botName}</b> (@${bot.userName}) 已过期\n` +
                `到期时间: ${bot.disabledAt?.toLocaleString()}\n` +
                `请及时续费以继续使用服务。`,
              { parse_mode: 'HTML' },
            );
            console.log(
              `[updateBotExpiration] 已通知拥有者 ${owner.id} 机器人过期`,
            );
          } catch (msgErr) {
            console.error(
              `[updateBotExpiration] 通知拥有者 ${owner.id} 失败:`,
              msgErr,
            );
          }
        }
      }

      console.log(`[updateBotExpiration] 机器人 ${bot.botName} 已发送过期通知`);
    }

    console.log('[updateBotExpiration] 过期机器人处理完成');
  } catch (error) {
    console.error('[updateBotExpiration] 处理过期机器人时出错:', error);
    throw error;
  }
};
