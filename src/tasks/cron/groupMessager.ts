import GroupMessage, { IGroupMessage } from '../../models/groupMessage';
import Bot from '../../models/bot';
import { IGroup } from '../../models/group';
import { formatBeijingDate } from '../../utils/formatBeijingDate';
import { setupBot } from '../../bot/botSetup';
import { InlineKeyboard, InputFile } from 'grammy';

/**
 * 群发消息任务
 */
export async function sendGroupMessages() {
  try {
    console.log('[sendGroupMessages] 开始处理群发消息...');

    const currentTime = new Date();

    console.log(`[当前时间] ${formatBeijingDate(currentTime)}`);

    // 查询所有机器人
    const bots = await Bot.find({}).populate({
      path: 'groupMessages',
      match: { isRealtime: false }, // 只处理定时发送的消息
      populate: {
        path: 'groups',
      },
      options: { sort: { weight: +1 } },
    });

    console.log(`[sendGroupMessages] 查询到 ${bots.length} 个机器人`);

    const stats = {
      processed: 0,
      sent: 0,
      skipped: 0,
      errors: 0,
    };

    for (const bot of bots) {
      console.log(
        `[sendGroupMessages] 开始处理机器人: ${bot.botName} (${bot._id})`,
      );

      // 设置机器人
      const telegramBot = setupBot(bot.token);

      // 查询当前机器人需要发送的群发消息
      // 只筛选 isOnline 为 true 的群发消息
      const groupMessages = (bot.groupMessages as IGroupMessage[]).filter(
        (message) => message.isOnline === true,
      );

      console.log(
        `[sendGroupMessages] 机器人 ${bot.botName} 查询到 ${groupMessages.length} 条群发消息`,
      );

      if (groupMessages.length === 0) {
        console.log(
          `[sendGroupMessages] 机器人 ${bot.botName} 没有需要发送的群发消息，跳过`,
        );
        continue;
      }

      for (const message of groupMessages) {
        try {
          stats.processed++;
          // 只筛选 isOnline 为 true 的群组
          const groups = message.groups as IGroup[];

          console.log('groups', groups);

          if (!groups || groups.length === 0) {
            console.warn(
              `[sendGroupMessages] 消息 ${message._id} 没有关联的群组，跳过`,
            );
            stats.skipped++;
            continue;
          }

          // 检查是否已达到间隔时间
          const intervalHours = message.intervalTime || 24; // 默认为24小时
          const lastSentTime = message.updatedAt || message.createdAt;
          const hoursSinceLastSent =
            (currentTime.getTime() - lastSentTime.getTime()) / (1000 * 60 * 60);

          console.log('hoursSinceLastSent', hoursSinceLastSent);
          console.log('intervalHours', intervalHours);

          if (hoursSinceLastSent < intervalHours) {
            console.log(
              `[sendGroupMessages] 消息 ${message._id} 距离上次发送不足 ${intervalHours} 小时，跳过`,
            );
            stats.skipped++;
            continue;
          }

          let sentCount = 0;

          // 向每个群组发送消息
          for (const group of groups) {
            try {
              if (!group) {
                console.log(`[sendGroupMessage] 群组不存在: ${group}`);
                continue;
              }
              // 构建菜单 InlineKeyboard, 支持每行多个菜单按钮
              let replyMarkup: InlineKeyboard | undefined = undefined;
              if (Array.isArray(message.menus) && message.menus.length > 0) {
                const perRow = message.menus_per_row || 1; // 默认每行1个按钮
                replyMarkup = new InlineKeyboard();

                for (let i = 0; i < message.menus.length; i += perRow) {
                  const rowMenus = message.menus.slice(i, i + perRow);
                  const buttons = rowMenus
                    .filter((menu) => menu.menuName && menu.url)
                    .map((menu) => ({
                      text: menu.menuName,
                      url: menu.url,
                    }));

                  // 添加这一行按钮
                  if (buttons.length > 0) {
                    replyMarkup.add(...buttons).row();
                  }
                }
              }

              // 如果成功，才发送消息
              if (Array.isArray(message.images) && message.images.length > 0) {
                if (message.images.length === 1) {
                  // 单张图片，直接 sendPhoto
                  await telegramBot.api.sendPhoto(
                    group.id,
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
                  await telegramBot.api.sendMediaGroup(group.id, media as any);

                  await telegramBot.api.sendMessage(group.id, message.content, {
                    parse_mode: 'HTML',
                    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
                  });
                }
              } else {
                // 发送纯文本消息
                await telegramBot.api.sendMessage(group.id, message.content, {
                  parse_mode: 'HTML',
                  ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
                });
              }
              sentCount++;
              console.log(`[sendGroupMessages] 已向群组 ${group.id} 发送消息`);
            } catch (err) {
              console.error(
                `[sendGroupMessages] 向群组 ${group?.id} 发送消息失败:`,
                err,
              );
              continue;
            }
          }

          // 只有当消息至少发送到一个群组时才更新发送时间
          if (sentCount > 0) {
            await GroupMessage.findByIdAndUpdate(message._id, {
              updatedAt: currentTime,
            });
            stats.sent++;
            console.log(
              `[sendGroupMessages] 消息 ${message._id} 已成功发送到 ${sentCount}/${groups.length} 个群组`,
            );
          } else {
            console.log(
              `[sendGroupMessages] 消息 ${message._id} 没有成功发送到任何群组`,
            );
          }
        } catch (error) {
          console.error(
            `[sendGroupMessages] 处理消息 ${message._id} 时发生错误:`,
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

    console.log('\n========== 群发消息任务统计 ==========');
    console.log(`[统计信息] 总消息数 (所有机器人): ${stats.processed}`);
    console.log(`[统计信息] 处理消息数: ${stats.processed}`);
    console.log(`[统计信息] 发送消息数: ${stats.sent}`);
    console.log(`[统计信息] 跳过消息数: ${stats.skipped}`);
    console.log(`[统计信息] 错误消息数: ${stats.errors}`);
    console.log(`[统计信息] 任务总耗时: ${taskDuration.toFixed(2)}秒`);
    console.log('========== 群发消息任务完成 ==========');
  } catch (error) {
    console.error('[sendGroupMessages] 处理群发消息时出错:', error);
  }
}
