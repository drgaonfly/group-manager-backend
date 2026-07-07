import Bot from '../../models/bot';
import { setupBot } from '../../bot/botSetup';
import BotUser from '../../models/botUser';

export const notifyBotExpiration = async () => {
  try {
    console.log('[notifyBotExpiration] 开始检查即将过期的机器人...');
    const now = new Date();
    console.log(now.toLocaleString('zh-CN', { hour12: false }));

    // Calculate the date 3 days from now
    const threeDaysLater = new Date(now);
    threeDaysLater.setDate(now.getDate() + 3);

    // Calculate the date 1 day from now
    const oneDayLater = new Date(now);
    oneDayLater.setDate(now.getDate() + 1);

    // Find all bots that will expire in 3 days and haven't been notified
    const expiringBots = await Bot.find({
      disabledAt: {
        $exists: true,
        $gt: now,
        $lte: threeDaysLater,
      },
      type: 'private',
      preExpirationNotified: { $ne: true },
    })
      .populate('owner')
      .populate('authorized_users');

    console.log(
      `[notifyBotExpiration] 查询到 ${expiringBots.length} 个即将过期的机器人`,
    );

    for (const bot of expiringBots) {
      console.log(`[notifyBotExpiration] 正在处理机器人: ${bot.botName}`);

      // 计算剩余天数
      const remainingDays = Math.ceil(
        (bot.disabledAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      // 如果剩余天数 <= 3，改为提前 1 天提醒
      if (remainingDays <= 3) {
        const oneDayCheck = await Bot.findOne({
          _id: bot._id,
          disabledAt: {
            $exists: true,
            $gt: now,
            $lte: oneDayLater,
          },
          preExpirationNotified: { $ne: true },
        });
        if (!oneDayCheck) {
          console.log(
            `[notifyBotExpiration] 机器人 ${bot.botName} 剩余 ${remainingDays} 天，跳过提前3天提醒，将在1天前提醒`,
          );
          continue;
        }
      }

      // 获取机器人实例
      const botInstance = setupBot(bot.token);

      // 通知拥有者
      if (bot.owner) {
        const owner = await BotUser.findById(bot.owner);
        if (owner?.id) {
          try {
            await botInstance.api.sendMessage(
              owner.id,
              `⚠️ 提醒：机器人 <b>${bot.botName}</b> (@${bot.userName}) 将在${remainingDays}天后过期\n` +
                `到期时间: ${bot.disabledAt?.toLocaleString()}\n` +
                `请及时续费以继续使用服务。`,
              { parse_mode: 'HTML' },
            );
            console.log(
              `[notifyBotExpiration] 已通知拥有者 ${owner.id} 机器人即将过期`,
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
                `⚠️ 提醒：您使用的机器人 <b>${bot.botName}</b> (@${bot.userName}) 将在${remainingDays}天后过期\n` +
                  `到期时间: ${bot.disabledAt?.toLocaleString()}\n` +
                  `请联系机器人管理员进行续费。`,
                { parse_mode: 'HTML' },
              );
              console.log(
                `[notifyBotExpiration] 已通知授权用户 ${user.id} 机器人即将过期`,
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

      // Mark the bot as notified for pre-expiration
      await Bot.updateOne(
        { _id: bot._id },
        { $set: { preExpirationNotified: true } },
      );

      console.log(`[notifyBotExpiration] 机器人 ${bot.botName} 已发送过期提醒`);
    }

    console.log('[notifyBotExpiration] 即将过期机器人通知处理完成');
  } catch (error) {
    console.error('[notifyBotExpiration] 处理即将过期机器人时出错:', error);
    throw error;
  }
};
