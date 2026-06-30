import Bot from '../../models/bot';
import { setupBot } from '../../bot/botSetup';
import BotUser from '../../models/botUser';

export const updateBotExpiration = async () => {
  try {
    console.log('[updateBotExpiration] 开始检查过期机器人...');
    const now = new Date();
    console.log(now.toLocaleString('zh-CN', { hour12: false }));

    // Find all bots that have expired but isExpired is false, and expireAt must exist
    const expiredBots = await Bot.find({
      expireAt: { $exists: true, $lt: now },
      isExpired: false,
      type: 'private',
    }).populate('owner');

    console.log(
      `[updateBotExpiration] 查询到 ${expiredBots.length} 个待处理的过期机器人`,
    );

    for (const bot of expiredBots) {
      console.log(`[updateBotExpiration] 正在处理机器人: ${bot.botName}`);

      // Update bot status
      await Bot.updateOne({ _id: bot._id }, { $set: { isExpired: true } });

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
                `到期时间: ${bot.expireAt?.toLocaleString()}\n` +
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

      // 通知所有授权用户
      if (bot.authorized_users && bot.authorized_users.length > 0) {
        for (const userId of bot.authorized_users) {
          const user = await BotUser.findById(userId);
          if (user?.id) {
            try {
              await botInstance.api.sendMessage(
                user.id,
                `⚠️ 您使用的机器人 <b>${bot.botName}</b> (@${bot.userName}) 已过期\n` +
                  `到期时间: ${bot.expireAt?.toLocaleString()}\n` +
                  `请联系机器人管理员进行续费。`,
                { parse_mode: 'HTML' },
              );
              console.log(
                `[updateBotExpiration] 已通知授权用户 ${user.id} 机器人过期`,
              );
            } catch (msgErr) {
              console.error(
                `[updateBotExpiration] 通知授权用户 ${user.id} 失败:`,
                msgErr,
              );
            }
          }
        }
      }

      console.log(`[updateBotExpiration] 机器人 ${bot.botName} 已标记为过期`);
    }

    console.log('[updateBotExpiration] 过期机器人处理完成');
  } catch (error) {
    console.error('[updateBotExpiration] 处理过期机器人时出错:', error);
    throw error;
  }
};
