import Bot from '../../models/bot';
import { setupBot } from '../../bot/botSetup';
import BotUser from '../../models/botUser';
import { redis } from '../../utils/redis';

/**
 * 检查即将过期的机器人（到期前 3 天内），每天发送一次提醒通知
 * 通知逻辑：
 * - 到期前 3 天：每天提醒一次，剩余 3 天
 * - 到期前 2 天：每天提醒一次，剩余 2 天
 * - 到期前 1 天：每天提醒一次，剩余 1 天
 * - 到期当天：不在这里处理（由 updateBotExpiration 处理）
 */
export const notifyBotExpiration = async () => {
  try {
    console.log('[notifyBotExpiration] 开始检查即将过期的机器人...');
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // 查找所有 type='private' 且在 3 天内过期的机器人
    const expiringBots = await Bot.find({
      disabledAt: {
        $exists: true,
        $gt: now, // 还未到期
        $lte: threeDaysLater, // 但在 3 天内会到期
      },
      type: 'private',
    })
      .populate('owner')
      .populate('authorized_users');

    console.log(
      `[notifyBotExpiration] 查询到 ${expiringBots.length} 个即将过期的机器人`,
    );

    for (const bot of expiringBots) {
      try {
        if (!bot.disabledAt) {
          console.log(
            `[notifyBotExpiration] 机器人 ${bot.botName} 没有 disabledAt，跳过`,
          );
          continue;
        }

        // 计算剩余天数
        const daysLeft = Math.ceil(
          (bot.disabledAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        );

        // 只在剩余 1、2、3 天时发送通知
        if (daysLeft < 1 || daysLeft > 3) {
          continue;
        }

        // 使用 Redis 记录今天是否已通知（避免重复）
        const todayKey = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const notifyKey = `bot_expiring_notified:${bot._id}:${todayKey}`;

        const alreadyNotified = await redis.get(notifyKey);
        if (alreadyNotified) {
          console.log(
            `[notifyBotExpiration] 机器人 ${bot.botName} 今天已通知过（剩余${daysLeft}天），跳过`,
          );
          continue;
        }

        console.log(
          `[notifyBotExpiration] 正在处理机器人: ${bot.botName}，剩余 ${daysLeft} 天`,
        );

        // 获取机器人实例
        const botInstance = setupBot(bot.token);
        const disabledAtStr = bot.disabledAt.toLocaleString('zh-CN', {
          hour12: false,
        });

        // 通知拥有者
        if (bot.owner) {
          const owner = await BotUser.findById(bot.owner);
          if (owner?.id) {
            try {
              await botInstance.api.sendMessage(
                owner.id,
                `⏰ <b>机器人即将过期提醒</b>\n\n` +
                  `您的机器人 <b>${bot.botName}</b> (@${bot.userName}) 还有 <b>${daysLeft} 天</b>到期。\n\n` +
                  `到期时间: <code>${disabledAtStr}</code>\n\n` +
                  `为避免服务中断，请及时续费。`,
                { parse_mode: 'HTML' },
              );
              console.log(
                `[notifyBotExpiration] 已通知拥有者 ${owner.id}，机器人剩余 ${daysLeft} 天`,
              );
            } catch (msgErr) {
              console.error(
                `[notifyBotExpiration] 通知拥有者 ${owner.id} 失败:`,
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
                  `⏰ <b>机器人即将过期提醒</b>\n\n` +
                    `您使用的机器人 <b>${bot.botName}</b> (@${bot.userName}) 还有 <b>${daysLeft} 天</b>到期。\n\n` +
                    `到期时间: <code>${disabledAtStr}</code>\n\n` +
                    `请联系机器人管理员进行续费。`,
                  { parse_mode: 'HTML' },
                );
                console.log(
                  `[notifyBotExpiration] 已通知授权用户 ${user.id}，机器人剩余 ${daysLeft} 天`,
                );
              } catch (msgErr) {
                console.error(
                  `[notifyBotExpiration] 通知授权用户 ${user.id} 失败:`,
                  msgErr,
                );
              }
            }
          }
        }

        // 在 Redis 中标记今天已通知（24 小时后自动过期）
        await redis.setex(notifyKey, 86400, '1');

        console.log(
          `[notifyBotExpiration] 机器人 ${bot.botName} 已发送过期提醒（剩余${daysLeft}天）`,
        );
      } catch (err) {
        console.error(
          `[notifyBotExpiration] 处理机器人 ${bot.botName} 时出错:`,
          err,
        );
      }
    }

    console.log('[notifyBotExpiration] 即将过期机器人通知处理完成');
  } catch (error) {
    console.error('[notifyBotExpiration] 处理即将过期机器人时出错:', error);
    throw error;
  }
};
