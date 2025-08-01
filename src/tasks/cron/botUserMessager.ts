import BotUserMessage, { IBotUserMessage } from '../../models/botUserMessage';
import Bot from '../../models/bot';
import { IBotUser } from '../../models/botUser';
import { formatBeijingDate } from '../../utils/formatBeijingDate';
import { setupBot } from '../../bot/botSetup';
import { InlineKeyboard, InputFile } from 'grammy';
import BotUserMessageHistory from '../../models/botUserMessageHistory';

/**
 * 给机器人用户发送消息任务
 */
export async function sendBotUserMessages() {
  try {
    console.log('[sendBotUserMessages] 开始处理机器人用户消息...');

    const currentTime = new Date();

    console.log(`[当前时间] ${formatBeijingDate(currentTime)}`);

    // 查询所有机器人并填充其关联的机器人用户消息
    const bots = await Bot.find({});

    console.log(`[sendBotUserMessages] 查询到 ${bots.length} 个机器人`);

    const stats = {
      processed: 0,
      sent: 0,
      skipped: 0,
      errors: 0,
    };

    for (const bot of bots) {
      const telegramBot = setupBot(bot.token);

      const raw_botUserMessages = await BotUserMessage.find({
        bot: bot._id,
      }).populate('botUsers');

      console.log(
        `[调试] Bot ${bot.userName} 有 ${raw_botUserMessages?.length} 条消息`,
      );

      const processed_botUserMessages = raw_botUserMessages
        .filter((msg) => msg.isOnline === true)
        .sort((a, b) => a.weight - b.weight); // 按权重升序

      if (processed_botUserMessages.length === 0) continue;

      for (const botUserMessage of processed_botUserMessages) {
        console.log('botUsers under botUserMessage', botUserMessage.botUsers);

        const botUsers = botUserMessage.botUsers as IBotUser[];
        if (!botUsers || botUsers.length === 0) continue;

        for (const botUser of botUsers) {
          try {
            const history = await BotUserMessageHistory.findOne({
              bot: bot._id,
              botUser: botUser._id,
            });

            let nextMessage: IBotUserMessage;
            let shouldSend = false;
            const intervalMs = bot.intervalTime * 60 * 60 * 1000;

            if (!history) {
              // 第一次发送，从第一条开始
              nextMessage = processed_botUserMessages[0];
              shouldSend = true;
            } else {
              const lastIndex = processed_botUserMessages.findIndex(
                (msg) =>
                  msg._id.toString() === history.lastSentMessage.toString(),
              );

              const timeSinceLast =
                Date.now() - new Date(history.sentAt).getTime();
              if (timeSinceLast >= intervalMs) {
                const nextIndex =
                  (lastIndex + 1) % processed_botUserMessages.length;
                nextMessage = processed_botUserMessages[nextIndex];
                shouldSend = true;
              } else {
                console.log(
                  `[跳过] 用户 ${botUser.id} 距离上次发送不足 ${bot.intervalTime} 小时`,
                );
                stats.skipped++;
                continue;
              }
            }

            if (!shouldSend) continue;

            // === 发送消息逻辑 ===
            let replyMarkup: InlineKeyboard | undefined;
            if (
              Array.isArray(nextMessage.menus) &&
              nextMessage.menus.length > 0
            ) {
              const perRow = nextMessage.menus_per_row || 1;
              replyMarkup = new InlineKeyboard();

              for (let i = 0; i < nextMessage.menus.length; i += perRow) {
                const rowMenus = nextMessage.menus.slice(i, i + perRow);
                const buttons = rowMenus
                  .filter((menu) => menu.menuName && menu.url)
                  .map((menu) => ({ text: menu.menuName, url: menu.url }));
                if (buttons.length > 0) replyMarkup.add(...buttons).row();
              }
            }

            if (nextMessage.images?.length > 0) {
              if (nextMessage.images.length === 1) {
                await telegramBot.api.sendPhoto(
                  botUser.id,
                  new InputFile(`tmp/${nextMessage.images[0]}`),
                  {
                    caption: nextMessage.content,
                    parse_mode: 'HTML',
                    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
                  },
                );
              } else {
                const media = nextMessage.images.map((img, idx) => ({
                  type: 'photo' as const,
                  media: new InputFile(`tmp/${img}`),
                  ...(idx === 0 ? { parse_mode: 'HTML' } : {}),
                }));
                await telegramBot.api.sendMediaGroup(botUser.id, media as any);
                await telegramBot.api.sendMessage(
                  botUser.id,
                  nextMessage.content,
                  {
                    parse_mode: 'HTML',
                    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
                  },
                );
              }
            } else {
              await telegramBot.api.sendMessage(
                botUser.id,
                nextMessage.content,
                {
                  parse_mode: 'HTML',
                  ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
                },
              );
            }

            // 更新历史
            await BotUserMessageHistory.findOneAndUpdate(
              { bot: bot._id, botUser: botUser._id },
              {
                lastSentMessage: nextMessage._id,
                sentAt: new Date(),
              },
              { upsert: true },
            );

            console.log(
              `[✅] 消息 ${nextMessage._id} 成功发送给 ${botUser.id}`,
            );
            stats.sent++;
          } catch (err) {
            console.error(`[❌] 向 ${botUser.id} 发送消息失败:`, err);
            stats.errors++;
            continue;
          }
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
