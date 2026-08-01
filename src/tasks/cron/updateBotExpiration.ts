import Bot from '../../models/bot';
import { setupBot } from '../../bot/botSetup';
import BotUser from '../../models/botUser';

/**
 * 检查已过期的机器人，发送到期当天的"已过期"通知
 * 只发送一次，通过 preExpirationNotified 标记避免重复
 */
export const updateBotExpiration = async () => {
  try {
    console.log('[updateBotExpiration] 开始检查已过期的机器人...');
    const now = new Date();

    // 查找所有已过期但尚未发送"已过期"通知的 private 机器人
    const expiredBots = await Bot.find({
      disabledAt: { $exists: true, $lt: now },
      type: 'private',
      preExpirationNotified: { $ne: true }, // 还未标记为已通知
    })
      .populate('owner')
      .populate('authorized_users');

    console.log(
      `[updateBotExpiration] 查询到 ${expiredBots.length} 个已过期且未通知的机器人`,
    );

    for (const bot of expiredBots) {
      try {
        console.log(`[updateBotExpiration] 正在处理机器人: ${bot.botName}`);

        // 获取机器人实例
        const botInstance = setupBot(bot.token);
        const disabledAtStr = bot.disabledAt
          ? bot.disabledAt.toLocaleString('zh-CN', { hour12: false })
          : '';

        // 通知拥有者
        if (bot.owner) {
          const owner = await BotUser.findById(bot.owner);
          if (owner?.id) {
            try {
              await botInstance.api.sendMessage(
                owner.id,
                `⚠️ <b>机器人已过期</b>\n\n` +
                  `您的机器人 <b>${bot.botName}</b> (@${bot.userName}) 已过期。\n\n` +
                  `到期时间: <code>${disabledAtStr}</code>\n\n` +
                  `如需继续使用服务，请及时续费。`,
                { parse_mode: 'HTML' },
              );
              console.log(
                `[updateBotExpiration] 已通知拥有者 ${owner.id} 机器人已过期`,
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
                  `⚠️ <b>机器人已过期</b>\n\n` +
                    `您使用的机器人 <b>${bot.botName}</b> (@${bot.userName}) 已过期。\n\n` +
                    `到期时间: <code>${disabledAtStr}</code>\n\n` +
                    `请联系机器人管理员进行续费。`,
                  { parse_mode: 'HTML' },
                );
                console.log(
                  `[updateBotExpiration] 已通知授权用户 ${user.id} 机器人已过期`,
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

        // 标记已通知，避免重复发送
        await Bot.updateOne(
          { _id: bot._id },
          { $set: { preExpirationNotified: true } },
        );

        console.log(
          `[updateBotExpiration] 机器人 ${bot.botName} 已发送过期通知并标记完成`,
        );
      } catch (err) {
        console.error(
          `[updateBotExpiration] 处理机器人 ${bot.botName} 时出错:`,
          err,
        );
      }
    }

    console.log('[updateBotExpiration] 已过期机器人通知处理完成');
  } catch (error) {
    console.error('[updateBotExpiration] 处理过期机器人时出错:', error);
    throw error;
  }
};
