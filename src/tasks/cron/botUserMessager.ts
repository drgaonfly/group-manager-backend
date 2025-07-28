import BotUserMessage, { IBotUserMessage } from '../../models/botUserMessage';
import Bot from '../../models/bot';
import { IBotUser } from '../../models/botUser';
import { formatBeijingDate } from '../../utils/formatBeijingDate';
import { setupBot } from '../../bot/botSetup';
import { InlineKeyboard, InputFile } from 'grammy';

/**
 * 给机器人用户发送消息任务
 */
export async function sendBotUserMessages() {
  try {
    console.log('[sendBotUserMessages] 开始处理机器人用户消息...');

    const currentTime = new Date();

    console.log(`[当前时间] ${formatBeijingDate(currentTime)}`);

    // 查询所有机器人并填充其关联的机器人用户消息
    const bots = await Bot.find({}).populate({
      path: 'botUserMessages',
      match: { type: 'sent' }, // 只处理定时发送的消息
      populate: {
        path: 'botUsers',
      },
      options: { sort: { weight: +1 } }, // 按权重升序排序
    });

    console.log(`[sendBotUserMessages] 查询到 ${bots.length} 个机器人`);

    const stats = {
      processed: 0,
      sent: 0,
      skipped: 0,
      errors: 0,
    };

    for (const bot of bots) {
      console.log(
        `[sendBotUserMessages] 开始处理机器人: ${bot.botName} (${bot._id})`,
      );

      // 设置机器人
      const telegramBot = setupBot(bot.token);

      // 获取当前机器人需要发送的机器人用户消息
      const botUserMessages = (bot.botUserMessages as IBotUserMessage[]).filter(
        (msg) => msg.isOnline === true,
      );

      console.log(
        `[sendBotUserMessages] 机器人 ${bot.botName} 查询到 ${botUserMessages.length} 条机器人用户消息`,
      );

      if (botUserMessages.length === 0) {
        console.log(
          `[sendBotUserMessages] 机器人 ${bot.botName} 没有需要发送的机器人用户消息，跳过`,
        );
        continue;
      }

      for (const message of botUserMessages) {
        try {
          stats.processed++;

          // botUsers 可能是 ObjectId[] 或 IBotUser[], 我们需要遍历每个用户
          const botUsers = message.botUsers as IBotUser[];

          if (!botUsers || botUsers.length === 0) {
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

          // 发送消息，支持图片
          if (message) {
            for (const botUser of botUsers) {
              if (Array.isArray(message.images) && message.images.length > 0) {
                if (message.images.length === 1) {
                  // 单张图片，直接 sendPhoto
                  await telegramBot.api.sendPhoto(
                    botUser.id,
                    new InputFile(`tmp/${message.images[0]}`),
                    {
                      caption: message.content,
                      parse_mode: 'HTML',
                      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
                    },
                  );
                } else {
                  // 多张图片，使用 sendMediaGroup
                  const media = message.images.map(
                    (img: string, idx: number) => {
                      return {
                        type: 'photo' as const,
                        media: new InputFile(`tmp/${img}`),
                        ...(idx === 0 ? { parse_mode: 'HTML' } : {}),
                      };
                    },
                  );
                  // sendMediaGroup 不支持 reply_markup（内联菜单），Telegram API 限制
                  await telegramBot.api.sendMediaGroup(
                    botUser.id,
                    media as any,
                  );
                  // 再补发文本和菜单
                  await telegramBot.api.sendMessage(
                    botUser.id,
                    message.content,
                    {
                      parse_mode: 'HTML',
                      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
                    },
                  );
                }
              } else {
                // 发送纯文本消息
                await telegramBot.api.sendMessage(botUser.id, message.content, {
                  parse_mode: 'HTML',
                  ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
                });
              }
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
    }

    // 输出统计信息
    const endTime = new Date();
    const taskDuration = (endTime.getTime() - currentTime.getTime()) / 1000;

    console.log('\n========== 机器人用户消息任务统计 ==========');
    console.log(`[统计信息] 总消息数 (所有机器人): ${stats.processed}`);
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
