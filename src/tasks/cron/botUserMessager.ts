import BotUserMessage from '../../models/botUserMessage';
import { IBot } from '../../models/bot';
import { IBotUser } from '../../models/botUser';
import { formatBeijingDate } from '../../utils/formatBeijingDate';
import { setupBot } from '../../bot/botSetup';
import { InlineKeyboard } from 'grammy';

/**
 * 给机器人用户发送消息任务
 */
export async function sendBotUserMessages() {
  try {
    console.log('[sendBotUserMessages] 开始处理机器人用户消息...');

    const currentTime = new Date();

    console.log(`[当前时间] ${formatBeijingDate(currentTime)}`);

    // 查询所有需要发送的机器人用户消息，示例只查询定时发送（非实时）消息
    const botUserMessages = await BotUserMessage.find({
      type: 'sent', // 假设你也有类似字段标识实时消息
    })
      .populate('bot')
      .populate('botUsers');

    console.log(
      `[sendBotUserMessages] 查询到 ${botUserMessages.length} 条机器人用户消息`,
    );

    const stats = {
      processed: 0,
      sent: 0,
      skipped: 0,
      errors: 0,
    };

    for (const message of botUserMessages) {
      try {
        stats.processed++;

        const bot = message.bot as IBot;
        // botUsers 可能是 ObjectId[] 或 IBotUser[]，我们需要遍历每个用户
        const botUsers = message.botUsers as IBotUser[];

        if (!botUsers) {
          console.warn(
            `[sendBotUserMessages] 消息 ${message._id} 没有关联机器人用户，跳过`,
          );
          stats.skipped++;
          continue;
        }

        // 判断间隔时间，默认24小时
        const intervalHours = message.intervalTime || 24;
        const lastSentTime = message.updatedAt || message.createdAt;
        const hoursSinceLastSent =
          (currentTime.getTime() - lastSentTime.getTime()) / (1000 * 60 * 60);

        if (hoursSinceLastSent < intervalHours) {
          console.log(
            `[sendBotUserMessages] 消息 ${message._id} 距离上次发送不足 ${intervalHours} 小时，跳过`,
          );
          stats.skipped++;
          continue;
        }

        // 设置机器人
        const telegramBot = setupBot(bot.token);

        // 构建菜单 InlineKeyboard
        let replyMarkup: InlineKeyboard | undefined = undefined;
        if (Array.isArray(message.menus) && message.menus.length > 0) {
          const perRow = message.menus_per_row || 1;
          replyMarkup = new InlineKeyboard();

          for (let i = 0; i < message.menus.length; i += perRow) {
            const rowMenus = message.menus.slice(i, i + perRow);
            const buttons = rowMenus
              .filter((menu) => menu.menuName && menu.url)
              .map((menu) => ({
                text: menu.menuName,
                url: menu.url,
              }));

            if (buttons.length > 0) {
              replyMarkup.add(...buttons).row();
            }
          }
        }

        // 发送消息
        if (message) {
          for (const botUser of botUsers) {
            await telegramBot.api.sendMessage(botUser.id, message.content, {
              parse_mode: 'HTML',
              ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
            });
            console.log(
              `[sendBotUserMessages] 消息 ${message._id} 成功发送给机器人用户 ${botUser.id}`,
            );
          }
        }

        // 更新发送时间
        await BotUserMessage.findByIdAndUpdate(message._id, {
          updatedAt: currentTime,
        });

        stats.sent++;
      } catch (error) {
        console.error(
          `[sendBotUserMessages] 处理消息 ${message._id} 时发生错误:`,
          error,
        );
        stats.errors++;
        continue;
      }
    }

    // 输出统计信息
    const endTime = new Date();
    const taskDuration = (endTime.getTime() - currentTime.getTime()) / 1000;

    console.log('\n========== 机器人用户消息任务统计 ==========');
    console.log(`[统计信息] 总消息数: ${botUserMessages.length}`);
    console.log(`[统计信息] 处理消息数: ${stats.processed}`);
    console.log(`[统计信息] 发送消息数: ${stats.sent}`);
    console.log(`[统计信息] 跳过消息数: ${stats.skipped}`);
    console.log(`[统计信息] 错误消息数: ${stats.errors}`);
    console.log(`[统计信息] 任务总耗时: ${taskDuration.toFixed(2)}秒`);
    console.log('========== 机器人用户消息任务完成 ==========');
  } catch (error) {
    console.error('[sendBotUserMessages] 处理机器人用户消息时出错:', error);
  }
}
